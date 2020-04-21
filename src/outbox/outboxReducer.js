/* @flow strict-local */
import type { OutboxState, Action, Outbox } from '../types';
import {
  INITIAL_FETCH_COMPLETE,
  MESSAGE_SEND_START,
  EVENT_NEW_MESSAGE,
  LOGOUT,
  ACCOUNT_SWITCH,
  DELETE_OUTBOX_MESSAGE,
  UPDATE_OUTBOX_MESSAGE_STATUS,
  MESSAGE_SEND_COMPLETE,
} from '../actionConstants';
import { NULL_ARRAY } from '../nullObjects';
import { filterArray } from '../utils/immutability';
import * as logging from '../utils/logging';

const initialState = NULL_ARRAY;

const messageSendStart = (state, action) => {
  const message = state.find(item => item.timestamp === action.outbox.timestamp);
  if (message) {
    return state;
  }
  return [...state, { ...action.outbox }];
};

const updateOutboxMessageStatus = (state, action) => {
  const index = state.findIndex(s => s.timestamp === action.local_message_id);
  if (index === -1) {
    return state;
  }

  const item = state[index];
  if (item.status.type === 'terminal') {
    logging.error('Attempted to transition outbox message away from terminal state', {
      item,
      newStatus: action.status,
    });
    return state;
  }

  return [...state.slice(0, index), { ...item, status: action.status }, ...state.slice(index + 1)];
};

export default (state: OutboxState = initialState, action: Action): OutboxState => {
  switch (action.type) {
    case INITIAL_FETCH_COMPLETE:
      return filterArray(state, (outbox: Outbox) => !outbox.isSent);

    case MESSAGE_SEND_START:
      return messageSendStart(state, action);

    case MESSAGE_SEND_COMPLETE:
      return state.map(item =>
        item.id !== action.local_message_id ? item : { ...item, isSent: true },
      );

    case DELETE_OUTBOX_MESSAGE:
    case EVENT_NEW_MESSAGE:
      return filterArray(state, item => item && item.timestamp !== +action.local_message_id);

    case UPDATE_OUTBOX_MESSAGE_STATUS:
      return updateOutboxMessageStatus(state, action);

    case ACCOUNT_SWITCH:
    case LOGOUT:
      return initialState;

    default:
      return state;
  }
};
