// @flow strict-local

/**
 * Heartbeat: Perform callbacks at regular intervals.
 *
 * While active, calls `callback` every `milliseconds` milliseconds. While
 * inactive, does nothing.
 *
 * When transitioning from active to inactive, performs one additional edge-
 * triggered callback iff fewer than `milliseconds` milliseconds have elapsed
 * since the previous callback.
 *
 * (Despite the generic-looking definition, this class is closely tailored to
 * user-presence reporting.)
 */
class Heartbeat {
  // There are two notable kinds of potential misbehavior for this class:
  //   1. Calling the callback too often.
  //   2. Calling the callback too rarely.
  //
  // Exactly what "too often" and "too rarely" boil down to is fuzzy; the Zulip
  // server is necessarily fairly lenient, as it must be robust in the face of
  // network traffic fluctuations. To nail it down a bit, we assert that
  // `Heartbeat` satisfies the following properties:
  //
  //   α. If the Heartbeat is active, there has always been at least one call
  //      made to `callback` within the last approximate interval.
  //   β. Within any approximate interval, there are no more than three calls
  //      made to `callback`.
  //   γ. If the Heartbeat is inactive, no calls are made.
  //
  // ("approximate interval" covers real-world variation like scheduler delays
  // and callback execution time. It's a bit fuzzy here, but we define it
  // precisely in tests.)

  _callback: () => void;
  _milliseconds: number;

  _active: boolean = false;
  _intervalId: IntervalID | null = null;
  _previousTime: number = -Infinity;

  constructor(callback: () => void, milliseconds: number) {
    this._callback = callback;
    this._milliseconds = milliseconds;
  }

  doCallback = () => {
    if (!this._active) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      return;
    }

    this._previousTime = Date.now();
    this._callback();
  };

  /** PRIVATE. Exposed only for tests. */
  isActive() {
    return this._active;
  }

  /** Start the heartbeat. Idempotent. */
  start() {
    if (this._active) {
      return;
    }

    this._active = true;

    if (this._previousTime + this._milliseconds <= Date.now()) {
      this.doCallback();
    }

    if (this._intervalId === null) {
      this._intervalId = setInterval(this.doCallback, this._milliseconds, true);
    }
  }

  /** Stop the heartbeat. Idempotent. */
  stop() {
    this._active = false;
  }

  /** Set the current heartbeat state. Idempotent. */
  toState(active: boolean) {
    if (active) {
      this.start();
    } else {
      this.stop();
    }
  }
}

export default Heartbeat;
