// @flow strict-local
import deepFreeze from 'deep-freeze';

import type { OutboxStatus } from '../outboxTypes';
import outboxReducer from '../outboxReducer';
import { INITIAL_FETCH_COMPLETE, MESSAGE_SEND_START } from '../../actionConstants';

import * as eg from '../../__tests__/lib/exampleData';

const unsentStatus: OutboxStatus = {
  type: 'transient',
  subtype: 'enqueued',
  failure: null,
};

const sentStatus: OutboxStatus = {
  type: 'transient',
  subtype: 'sent',
};

const clientErrorStatus: OutboxStatus = {
  type: 'terminal',
  subtype: 'client error',
  failure: {
    httpStatus: 418,
    apiCode: 'OUT_OF_CHEESE_ERROR',
    text: 'redo from start',
  },
};

const miscErrorStatus: OutboxStatus = {
  type: 'terminal',
  subtype: 'misc',
  message: 'As Gregor Samsa awoke one morning from uneasy dreams, he found',
};

/**
 * Silence (but confirm the presence of) expected console output.
 */
// The strange declaration here is because VSCode's syntax highlighter goes
// off the rails when given an arrow function with a generic signature.
const expectingConsole = function expectingConsole_<T>(
  which: 'log' | 'info' | 'warn' | 'error',
  f: () => T,
): T {
  const spy = jest.spyOn(global.console, which).mockImplementation(() => {});
  try {
    return f();
  } finally {
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  }
};

describe('outboxReducer', () => {
  describe('INITIAL_FETCH_COMPLETE', () => {
    test('filters out isSent', () => {
      const message1 = eg.makeOutboxMessage({ content: 'New one' });
      const message2 = eg.makeOutboxMessage({ content: 'Another one' });
      const message3 = eg.makeOutboxMessage({ content: 'Message already sent', isSent: true });
      const initialState = deepFreeze([message1, message2, message3]);

      const action = deepFreeze({
        type: INITIAL_FETCH_COMPLETE,
      });

      const expectedState = [message1, message2];

      const actualState = outboxReducer(initialState, action);

      expect(actualState).toEqual(expectedState);
    });
  });

  describe('MESSAGE_SEND_START', () => {
    test('add a new message to the outbox', () => {
      const message = eg.makeOutboxMessage({ content: 'New one' });

      const initialState = deepFreeze([]);

      const action = deepFreeze({
        type: MESSAGE_SEND_START,
        outbox: message,
      });

      const expectedState = [message];

      const actualState = outboxReducer(initialState, action);

      expect(actualState).toEqual(expectedState);
    });

    test('do not add a message with a duplicate timestamp to the outbox', () => {
      const message1 = eg.makeOutboxMessage({ content: 'hello', timestamp: 123 });
      const message2 = eg.makeOutboxMessage({ content: 'hello twice', timestamp: 123 });

      const initialState = deepFreeze([message1]);

      const action = deepFreeze({
        type: MESSAGE_SEND_START,
        outbox: message2,
      });

      const actualState = outboxReducer(initialState, action);

      expect(actualState).toBe(initialState);
    });
  });

  describe('EVENT_NEW_MESSAGE', () => {
    test('do not mutate state if a message is not removed', () => {
      const initialState = deepFreeze([eg.makeOutboxMessage({ timestamp: 546 })]);

      const message = eg.streamMessage({ local_message_id: 123 });

      const action = deepFreeze({
        ...eg.eventNewMessageActionBase,
        message,
      });

      const actualState = outboxReducer(initialState, action);
      expect(actualState).toBe(initialState);
    });

    test('remove message if local_message_id matches', () => {
      const message1 = eg.makeOutboxMessage({ timestamp: 546, status: sentStatus });
      const message2 = eg.makeOutboxMessage({ timestamp: 150238512430 });
      const message3 = eg.makeOutboxMessage({ timestamp: 150238594540 });
      const initialState = deepFreeze([message1, message2, message3]);

      const action = deepFreeze({
        ...eg.eventNewMessageActionBase,
        message: eg.streamMessage(),
        local_message_id: 546,
      });

      const expectedState = [message2, message3];

      const actualState = outboxReducer(initialState, action);

      expect(actualState.length).toEqual(expectedState.length);
      expect(actualState).toEqual(expectedState);
    });

    test("remove nothing if local_message_id doesn't match", () => {
      const message1 = eg.makeOutboxMessage({ timestamp: 546 });
      const message2 = eg.makeOutboxMessage({ timestamp: 150238512430 });
      const message3 = eg.makeOutboxMessage({ timestamp: 150238594540 });
      const initialState = deepFreeze([message1, message2, message3]);

      const action = deepFreeze({
        ...eg.eventNewMessageActionBase,
        message: eg.streamMessage(),
        local_message_id: 15023859,
      });

      const actualState = expectingConsole('warn', () => outboxReducer(initialState, action));
      expect(actualState).toBe(initialState);
    });
  });

  describe('UPDATE_OUTBOX_MESSAGE_STATUS', () => {
    test('status of the relevant message is changed', () => {
      const message0 = eg.makeOutboxMessage({ timestamp: 546 });
      const message1 = eg.makeOutboxMessage({ timestamp: 547, status: unsentStatus });
      const message2 = eg.makeOutboxMessage({ timestamp: 548 });
      const message3 = eg.makeOutboxMessage({ timestamp: 549 });

      const initialState = deepFreeze([message0, message1, message2, message3]);

      const action = {
        type: 'UPDATE_OUTBOX_MESSAGE_STATUS',
        local_message_id: 547,
        status: clientErrorStatus,
      };

      const actualState = outboxReducer(initialState, action);

      // Everything but the status of the relevant message is untouched...
      expect(actualState).toEqual([
        message0,
        { ...message1, status: expect.anything() },
        message2,
        message3,
      ]);

      // ... and the status is what was specified in the action.
      expect(actualState[1].status).toEqual(action.status);
    });
  });
});
