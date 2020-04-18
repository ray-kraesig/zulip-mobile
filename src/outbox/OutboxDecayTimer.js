// @flow strict-local

import { PureComponent } from 'react';

import type { Dispatch, Outbox } from '../types';
import { DECAY_TIME_MS } from './outboxTypes';
import { connect } from '../react-redux';
import * as logging from '../utils/logging';
import { updateOutboxMessageStatus } from './outboxActions';

type SelectorProps = {|
  outboxItems: Outbox[],
|};

type Props = $ReadOnly<{|
  dispatch: Dispatch,
  ...SelectorProps,
|}>;

/**
 * Component to manage the decay of outbox messages.
 *
 * If an outbox message has been in the [XXX finish]
 */
class OutboxDecayTimer extends PureComponent<Props> {
  timers = new Map<number, TimeoutID>();

  decay(timestamp: number) {
    this.timers.delete(timestamp);

    const outboxItems = this.props.outboxItems;
    const item: Outbox | void = outboxItems.find(s => s.timestamp === timestamp);

    // This is not necessarily an error -- it may happen legitimately, given
    // appropriately unlucky timing -- but it's believed to be far more likely
    // to be an error than real.
    if (item === undefined) {
      logging.error('Decay timer ran out for nonexistent outbox item', {
        timestamp,
        now: Date.now() / 1000,
      });
      return;
    }

    this.props.dispatch(
      updateOutboxMessageStatus(timestamp, {
        type: 'terminal',
        subtype: 'age',
        previousStatus: item.status,
      }),
    );
  }

  // Start a timer for the message with this timestamp. Idempotent.
  startTimer(timestamp: number) {
    if (this.timers.has(timestamp)) {
      return;
    }
    const decayTime = timestamp * 1000 + DECAY_TIME_MS;
    const timeUntilDecay = Date.now() - decayTime;

    const timer = setTimeout(() => this.decay(timestamp), timeUntilDecay);
    this.timers.set(timestamp, timer);
  }

  // Stop a timer for the message with this timestamp. Idempotent.
  stopTimer(timestamp: number) {
    const timer = this.timers.get(timestamp);
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    this.timers.delete(timestamp);
  }

  // At unmount time, stop everything.
  componentWillUnmount() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  render() {
    // (To become) the set of timestamps of all the messages currently in the
    // Outbox.
    const timestamps = new Set<number>();

    // Ensure timers are set/unset as needed for any messages that are present.
    for (const item of this.props.outboxItems) {
      timestamps.add(item.timestamp);
      if (item.status.type === 'terminal') {
        this.stopTimer(item.timestamp);
      } else {
        this.startTimer(item.timestamp);
      }
    }

    // Remove any timers for messages that are now absent.
    for (const key of this.timers.keys()) {
      if (!timestamps.has(key)) {
        this.stopTimer(key);
      }
    }

    return null;
  }
}

export default connect<SelectorProps, _, _>((state, props) => ({
  outboxItems: state.outbox,
}))(OutboxDecayTimer);
