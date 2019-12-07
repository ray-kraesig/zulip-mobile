/* @flow strict-local */
import type { UnreadStreamsState, Action } from '../types';
import type {
  EventNewMessageAction,
  EventUpdateMessageFlagsAction,
} from '../actionTypes';
import {
  REALM_INIT,
  LOGOUT,
  ACCOUNT_SWITCH,
  EVENT_NEW_MESSAGE,
  EVENT_MESSAGE_DELETE,
  EVENT_UPDATE_MESSAGE_FLAGS,
} from '../actionConstants';
import { addItemsToStreamArray, removeItemsDeeply } from './unreadHelpers';
import { NULL_ARRAY } from '../nullObjects';

const initialState: UnreadStreamsState = NULL_ARRAY;

const eventNewMessage = (state: UnreadStreamsState, action: EventNewMessageAction): UnreadStreamsState => {
  if (action.message.type !== 'stream') {
    return state;
  }

  if (action.ownEmail && action.ownEmail === action.message.sender_email) {
    return state;
  }

  return addItemsToStreamArray(
    state,
    [action.message.id],
    action.message.stream_id,
    action.message.subject,
  );
};

const eventUpdateMessageFlags = (state: UnreadStreamsState, action: EventUpdateMessageFlagsAction): UnreadStreamsState => {
  if (action.flag !== 'read') {
    return state;
  }

  if (action.all) {
    return initialState;
  }

  if (action.operation === 'add') {
    return removeItemsDeeply(state, action.messages);
  } else if (action.operation === 'remove') {
    // we do not support that operation
  }

  return state;
};

export default (state: UnreadStreamsState = initialState, action: Action): UnreadStreamsState => {
  switch (action.type) {
    case LOGOUT:
    case ACCOUNT_SWITCH:
      return initialState;

    case REALM_INIT:
      return (action.data.unread_msgs && action.data.unread_msgs.streams) || initialState;

    case EVENT_NEW_MESSAGE:
      return eventNewMessage(state, action);

    case EVENT_MESSAGE_DELETE:
      return removeItemsDeeply(state, [action.messageId]);

    case EVENT_UPDATE_MESSAGE_FLAGS:
      return eventUpdateMessageFlags(state, action);

    default:
      return state;
  }
};
