// @flow strict-local
import { Lolex } from '../../__tests__/auxiliary/lolex';
import Heartbeat from '../heartbeat';

/** Fake clock implementation. See 'auxiliary/lolex' for more details. */
let lolex: Lolex;

// (hopefully) restrictive type alias for Jest's mock callback functions
type CallbackType = JestMockFn<$ReadOnlyArray<void>, void>;

/**
 * Utility function. Given an array and a length n, return each possible slice
 * of length n of that array.
 */
function slidingWindow<T>(arr: T[], length: number): T[][] {
  return arr.slice(0, arr.length - length + 1).map((_, i) => arr.slice(i, i + length));
}

describe('Heartbeat', () => {
  // ===================================================================
  // Constants and conveniences

  // arbitrarily, one full hour between heartbeats
  const HEARTBEAT_TIME = 60 * 60 * 1000;

  /**
   * "The course of false time never did run smooth." -- Shakespeare, probably
   *
   * Since we're using fake timers, two sequential events can appear to occur
   * "at the same time". This can confuse simple comparisons terribly.
   *
   * We therefore represent an event time as a dual number (a + bε). The real
   * part (a) is the readout of Date.now(), while the infinitesimal part (b) is
   * an integer which differentiates the two.
   *
   * The dual number itself we represent as a 2-tuple [a, b]. (We could just say
   * "we represent times as 2-tuples with the lexicographic ordering", but the
   * "real"/"infinitesimal" terminology is useful.)
   */
  type TimeVector = [number, number];

  type HeartbeatEventType = 'activate' | 'deactivate' | 'callback';
  type HeartbeatEventRaw = {
    type: HeartbeatEventType,
    timeVector: TimeVector,
  };
  type HeartbeatEvent = {
    type: HeartbeatEventType,
    time: number,
  };

  /**
   * Create an (order-preserving) homomorphism M: V → ℝ, for some finite set V
   * of TimeVectors.
   */
  const createTimeMapping = (times: TimeVector[]): (TimeVector => number) => {
    /*
      The reals ℝ and the dual numbers ⅅ are of different order types: in
      particular, there is no injective homomorphism ⅅ ↣ ℝ. However, as we only
      need to worry about a known, finite domain V ⊊ ⅅ, we have our choice of
      uncountably many homomorphisms M: V ↣ ℝ. We (ab)use this freedom to encode
      additional useful properties in our choice of M.

      Below, we denote arbitrary TimeVectors as v, v1, v2, ... and their images
      as t = M(v), t1 = M(v1), t2 = M(v2)...; the real and infinitesimal parts
      of a TimeVector are denoted Re(v) and In(v).

      We ensure that the mapping we create has the following qualities:

      (1)  v1 < v2 ⇒ t1 < t2.

        ... _i.e._ that M is a homomorphism at all.

      (2)  |t1 - t2| ≤ 1 ⟺ Re(v1) = Re(v2).

        This allows us to trivially test, without keeping around additional
        metadata, whether two times differ from each other only infinitesimally.

        This is useful for testing predicates which should approximately hold:
        we formalize that as meaning the predicate holds everywhere except
        possibly over finitely many intervals of strictly infinitesimal measure.

      (3)  ∀k ∈ ℝ: t1 + k = M(v1 + k).

        This ensures that it makes sense to add a number representing a
        sufficiently-large time interval (like HEARTBEAT_TIME) to values in the
        image of M. The result will be a plausible, correctly-ordered distance.

        Note that this property can't actually be satisfied for all possible
        inputs -- at least, not while also satisfying (1) and (2). We _could_
        substitute one of

          (2′)  ∃ℓ ∈ ℝ: |t1 - t2| ≤ ℓ ⟺ Re(v1) = Re(v2)
          (3′)  ∃ℎ ∈ ℝ: t1 + ℎ⋅k = Re(v1 + k)

        to satisfy instead, but then we'd have to pass around and use at least
        one scaling factor in various places. It's simpler just to fail if we
        can't use ℓ = ℎ = 1. (It isn't particularly onerous to require that our
        tests not generate sequences of events that are so closely spaced as to
        prevent it.)

      (4)  The values of Re(v) and In(v) are human-readable in t.

        This is just for convenience when looking at logs. We don't rely on it
        for correctness.
    */

    // minimum difference between real parts of consecutive timeVector groups
    const min_delta_a: number = Math.min(
      ...slidingWindow(times.map(([a]) => a), 2).map(([l, r]) => r - l || Infinity),
    );

    // This ensures that (2) and (3) can hold simultaneously. (The unusual
    // condition ensures that we also throw on NaN.)
    if (!(min_delta_a >= 2)) {
      throw new Error(`minimum real Δt ${min_delta_a} is too low!`);
    }

    // maximum value of infinitesimal part of timeVector
    const max_b: number = Math.max(...times.map(([, b]) => b));

    // Any value greater than max_b will satisfy (2); we choose a power of ten
    // to also satisfy (4).
    const adjustment = 10 ** (1 + Math.floor(Math.log10(max_b + 1)));

    return ([a, b]) => a + b / adjustment;
  };

  /**
   * Wrapper class for Heartbeat.
   *
   * Since Heartbeat erases its callback type (and `callback` should be private
   * anyway!), it's inconvenient to access the Jest mock functionality of
   * Heartbeat's callback. This wrapper provides fully-typed access to the
   * callback.
   *
   * As a convenience, we also keep track of the current set of Heartbeats used
   * by test cases.
   */
  class JestHeartbeatHelper {
    /** List of heartbeats used in the current test. */
    static _currentHeartbeats: Array<JestHeartbeatHelper> = [];

    // ==============================================================
    // Event tracking

    _last_event_time: TimeVector = [-Infinity, 0];
    _events_raw: HeartbeatEventRaw[] = [];
    _events: HeartbeatEvent[] | null = null; // for memoization

    _recordEvent(type: 'activate' | 'deactivate' | 'callback') {
      const now = Date.now();
      const [lastA, lastB] = this._last_event_time;
      const timeVector: TimeVector = lastA === now ? [now, lastB + 1] : [now, 0];

      this._events_raw.push({ type, timeVector });
      this._last_event_time = timeVector;
      this._events = null; // clear cache
    }

    // ==============================================================
    // Public interface

    callback: CallbackType;
    heartbeat: Heartbeat;

    constructor() {
      this.callback = jest.fn().mockImplementation(() => this._recordEvent('callback'));
      this.heartbeat = new Heartbeat(this.callback, HEARTBEAT_TIME);
      // eslint-disable-next-line no-underscore-dangle
      JestHeartbeatHelper._currentHeartbeats.push(this);
    }

    start() {
      this._recordEvent('activate');
      this.heartbeat.start();
    }
    stop() {
      this._recordEvent('deactivate');
      this.heartbeat.stop();
    }
    isActive(): boolean {
      return this.heartbeat.isActive();
    }

    getEvents(): $ReadOnlyArray<HeartbeatEvent> {
      if (this._events === null) {
        const mapping: TimeVector => number = createTimeMapping(
          this._events_raw.map(({ timeVector }) => timeVector),
        );

        this._events = this._events_raw.map(({ type, timeVector }) => ({
          type,
          time: mapping(timeVector),
        }));
      }

      return this._events;
    }

    static getExtant(): $ReadOnlyArray<JestHeartbeatHelper> {
      return this._currentHeartbeats;
    }
    static clearExtant() {
      this._currentHeartbeats = [];
    }
  }

  // convenience function: create a new Heartbeat with its associated callback
  const setup = (): {|
    callback: CallbackType,
    heartbeat: JestHeartbeatHelper,
  |} => {
    const heartbeat = new JestHeartbeatHelper();
    const { callback } = heartbeat;
    return { heartbeat, callback };
  };

  /**
   * Check that the supplied heartbeat is running, and confirm that it continues
   * to run for at least `count` cycles.
   */
  const expectRunning = (heartbeat: JestHeartbeatHelper, count: number = 10) => {
    const { callback } = heartbeat;
    for (let i = 0; i < count; ++i) {
      callback.mockClear();
      lolex.runOnlyPendingTimers();
      expect(callback).toHaveBeenCalled();
    }
    callback.mockClear();
  };

  /** Check that the supplied heartbeat is not running. */
  const expectNotRunning = (heartbeat: JestHeartbeatHelper) => {
    const { callback } = heartbeat;

    callback.mockClear();

    lolex.runOnlyPendingTimers();
    expect(callback).not.toHaveBeenCalled();

    lolex.advanceTimersByTime(HEARTBEAT_TIME * 10);
    expect(callback).not.toHaveBeenCalled();
  };

  // ===================================================================
  // Jest hooks

  // before running tests: set up fake timer API
  beforeAll(() => {
    // jest.useFakeTimers();
    lolex = new Lolex();
  });

  afterAll(() => {
    // jest.useRealTimers();
    lolex.dispose();
    JestHeartbeatHelper.clearExtant();
  });

  // before each test: reset common state
  beforeEach(() => {
    lolex.clearAllTimers();
    JestHeartbeatHelper.clearExtant();
  });

  // after each test: confirm common properties
  afterEach(() => {
    const heartbeats = JestHeartbeatHelper.getExtant();

    for (const heartbeat of heartbeats) {
      // Tests should stop all their Heartbeats.
      expect(heartbeat.isActive()).toBeFalse();
      heartbeat.callback.mockClear();
    }

    // Stopped heartbeats may have timers running, but those timers should not
    // persist beyond their next firing...
    lolex.runOnlyPendingTimers();
    expect(lolex.getTimerCount()).toBe(0);

    // ... and none of those _timer_ firings should result in a _callback_
    // firing.
    for (const heartbeat of heartbeats) {
      expect(heartbeat.callback).not.toHaveBeenCalled();
    }
  });

  // ===================================================================
  // Test cases

  test('starts inactive', () => {
    const { heartbeat, callback } = setup();

    expect(heartbeat.isActive()).toBeFalse();
    expect(callback).not.toHaveBeenCalled();

    expectNotRunning(heartbeat);
  });

  test('can be turned on and off', () => {
    const { heartbeat, callback } = setup();

    expect(callback).not.toHaveBeenCalled();
    heartbeat.start();
    expect(callback).toHaveBeenCalled();

    expectRunning(heartbeat);

    heartbeat.stop();
    expect(callback).not.toHaveBeenCalled();

    expectNotRunning(heartbeat);
  });

  test('can be turned on and off repeatedly without signal', () => {
    const { heartbeat, callback } = setup();

    heartbeat.start();

    for (let i = 0; i < 10; ++i) {
      callback.mockClear();
      heartbeat.stop();
      expect(callback).not.toHaveBeenCalled();

      callback.mockClear();
      heartbeat.start();
      expect(callback).not.toHaveBeenCalled();
    }

    heartbeat.stop();
  });

  test('can be turned on and off repeatedly _with_ signal', () => {
    const { heartbeat, callback } = setup();

    heartbeat.start();

    for (let i = 0; i < 10; ++i) {
      callback.mockClear();
      heartbeat.stop();
      expect(callback).not.toHaveBeenCalled();

      // delay past HEARTBEAT_TIME
      callback.mockClear();
      lolex.advanceTimersByTime(HEARTBEAT_TIME * 1.1);
      expect(callback).not.toHaveBeenCalled();

      callback.mockClear();
      heartbeat.start();
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    }

    heartbeat.stop();
  });

  test('takes about the right amount of time', () => {
    const { heartbeat, callback } = setup();

    expect(callback).not.toHaveBeenCalled();
    heartbeat.start();
    expect(callback).toHaveBeenCalled();
    callback.mockClear();

    for (let i = 0; i < 10; ++i) {
      lolex.advanceTimersByTime(HEARTBEAT_TIME * 1.001);
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
      callback.mockClear();
    }

    heartbeat.stop();
    expect(callback).not.toHaveBeenCalled();
  });

  test('has idempotent stop()', () => {
    const { heartbeat, callback } = setup();

    expect(callback).not.toHaveBeenCalled();

    heartbeat.stop();
    expect(callback).not.toHaveBeenCalled();
    expectNotRunning(heartbeat);

    heartbeat.stop();
    expect(callback).not.toHaveBeenCalled();
    expectNotRunning(heartbeat);
  });

  test('has idempotent start()', () => {
    const { heartbeat, callback } = setup();

    expect(callback).not.toHaveBeenCalled();
    heartbeat.start();
    expect(callback).toHaveBeenCalled();

    expectRunning(heartbeat, 3);
    lolex.advanceTimersByTime(HEARTBEAT_TIME * 0.25);
    expect(callback).not.toHaveBeenCalled();
    heartbeat.start();
    expect(callback).not.toHaveBeenCalled(); // sic!

    lolex.advanceTimersByTime(HEARTBEAT_TIME * 0.76);
    expect(callback).toHaveBeenCalled();

    heartbeat.stop();
  });
});
