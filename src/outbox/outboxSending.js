/* @flow strict-local */
import { createSelector } from 'reselect';

import * as api from '../api';
import { ApiError, isClientError } from '../api/apiErrors';
import * as logging from '../utils/logging';
import type { Dispatch, GetState, Outbox, Selector, Auth } from '../types';
import { getAuth, tryGetAuth } from '../account/accountsSelectors';

import { BackoffMachine } from '../utils/async';
import { isPrivateOrGroupNarrow } from '../utils/narrow';

import { type OutboxStatus } from './outboxTypes';
import { messageSendComplete, updateOutboxMessageStatus } from './outboxActions';

/**
 * Selector, for caching purposes. Does what it says on the tin.
 */
const getOutboxMessageByTimestamp: Selector<Outbox | void, number> = createSelector(
  (state, timestamp) => timestamp,
  state => state.outbox,
  (timestamp: number, outboxItems: Outbox[]) => outboxItems.find(s => s.timestamp === timestamp),
);

/**
 * Returns true if an attempt should be made to send this message.
 *
 * (Accepts `void` for convenience at some use-sites, since the semantics are
 * unambiguous.)
 */
const isSendable = (message: Outbox | void): boolean => {
  if (!message) {
    return false;
  }
  const { status } = message;
  return status.type === 'transient' && status.subtype === 'enqueued';
};

/**
 * Class encapsulating a test for the continued validity of an Auth.
 */
class AuthChecker {
  #getState: GetState;
  #auth: Auth;

  constructor(getState: GetState) {
    this.#getState = getState;
    this.#auth = getAuth(getState());
  }

  auth(): Auth {
    return this.#auth;
  }

  // The fact that we have to manually check the Auth after (almost) every await
  // in the code below suggests that we're doing _something_ inside-out and/or
  // backwards.
  //
  // (In a different language where one has more control over the executor of an
  // async function, one might attach the executor itself to the Auth: thus,
  // when the Auth is destroyed, all login-dependent execution is promptly
  // halted. In JavaScript, though, that's not really an option.)

  stillValid(): boolean {
    const auth = this.#auth;
    const auth2 = tryGetAuth(this.#getState.call()); // Flow issue #7877
    if (!auth2) {
      return false;
    }
    return auth.realm === auth2.realm && auth.email === auth2.email;
  }
}

/**
 * Makes a single attempt to send a particular message.
 *
 * No return value. (See its call site for details.)
 */
const trySendingMessageOnce = async (
  dispatch: Dispatch,
  getState: GetState,
  auth: Auth,
  message: Outbox,
  to: string,
) => {
  // Convenience alias.
  // XXX is this still useful?
  const updateStatus = (status: OutboxStatus) =>
    dispatch(updateOutboxMessageStatus(message.id, status));

  try {
    // Attempt the sending.
    await api.sendMessage(auth, {
      type: message.type,
      to,
      subject: message.subject,
      content: message.markdownContent,
      localId: message.timestamp,
      eventQueueId: getState().session.eventQueueId,
    });

    // Success!
    dispatch(messageSendComplete(message.id));
    // TODO: replace with updateStatus(...);
  } catch (e) {
    // Failure! We'll have to update the status appropriately.
    const newStatus: OutboxStatus = (() => {
      // If this is not an ApiError, something has gone terribly wrong.
      if (!(e instanceof ApiError)) {
        return { type: 'terminal', subtype: 'misc', message: e.message };
      }

      // Otherwise, this is a "normal" failure.
      const failure = {
        httpStatus: e.httpStatus,
        apiCode: e.code,
        text: e.message,
      };
      return isClientError(e)
        ? { type: 'terminal', subtype: 'client error', failure }
        : { type: 'transient', subtype: 'enqueued', failure };
    })();

    updateStatus(newStatus);

    // Log any terminal errors at this stage.
    if (newStatus.type === 'terminal') {
      logging.error(e);
    }

    // Our caller will know to retry if needed.
  }
};

/**
 * Repeatedly attempt to send the next message in the outbox which is ready to
 * be sent.
 *
 * Returns `false` if there is no such message, or `true` once the message has
 * been dequeued (for good or ill).
 */
const trySendingFirstMessage = async (dispatch: Dispatch, getState: GetState): Promise<boolean> => {
  const authChecker = new AuthChecker(getState);

  const item = getState().outbox.find(msg => isSendable(msg));
  if (item === undefined) {
    return false; // nothing left to do
  }

  // The `to` parameter for this message, precomputed.
  const to = ((): string => {
    const { narrow } = item;
    // TODO: can this test be `if (item.type === private)`?
    if (isPrivateOrGroupNarrow(narrow)) {
      return narrow[0].operand;
    } else {
      // HACK: the server attempts to interpret this argument as JSON, then
      // CSV, then a literal. To avoid misparsing, always use JSON.
      return JSON.stringify([item.display_recipient]);
    }
  })();

  const itemChecker = {
    /** Check whether this item ceased to be relevant while we were out. */
    stillValid(): boolean {
      return isSendable(getOutboxMessageByTimestamp(getState(), item.timestamp));
    },
  };

  // This backoff machine will be used for all attempts at sending this item.
  const waiter = new BackoffMachine();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Stop trying to resend this message if the auth has changed.
    // (This _should_ come with the outbox being cleared)
    if (!authChecker.stillValid()) {
      return true;
    }

    // Send the message.
    await trySendingMessageOnce(dispatch, getState, authChecker.auth(), item, to);

    // We could return early, as an optimization, if we knew that the message
    // had been dequeued by `trySendingMessageOnce`. However, we can't retry
    // just because it didn't -- the message might also have been asynchronously
    // dequeued by some other agent. (For example, the user could have deleted
    // the message, or it could have decayed due to age.)
    //
    // So we check explicitly.
    if (!itemChecker.stillValid()) {
      return true;
    }

    await waiter.wait();

    // Again, another agent may have dequeued this message during the await.
    if (!itemChecker.stillValid()) {
      return true;
    }
  }

  // (ESLint knows this is unreachable, but Flow doesn't)
  // eslint-disable-next-line no-unreachable
  throw new Error('unreachable');
};

/**
 * Helper object, encapsulating the "one run at a time" logic.
 *
 * Singleton, for simplicity's sake. (Could be made non-singular by storing its
 * flag in Redux.)
 */
const oneAtATime = {
  flag: false,

  async enact<T>(f: () => T) {
    if (this.flag) {
      return;
    }
    this.flag = true;
    try {
      await f();
    } finally {
      this.flag = false;
    }
  },
};

/**
 * Begin asynchronously sending any messages in the outbox.
 *
 * Idempotent: if the engine is already running, has no effect.
 *
 * (This is the sole entry point into this module.)
 */
export const startMessageSendingEngine = async (dispatch: Dispatch, getState: GetState) => {
  await oneAtATime.enact(async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Break out if there is no current auth.
      //
      // We don't want to monitor if the auth has changed here, just whether one
      // exists at all: it's possible that, while we're `await`ing in here, the
      // user has logged out and back in to another account and tried to send a
      // message. (The engine doesn't need to stop just to switch gears.)
      if (!tryGetAuth(getState())) {
        break;
      }
      // Also, break out if there are no more messages to send.
      if (!(await trySendingFirstMessage(dispatch, getState))) {
        break;
      }
    }
  });
};
