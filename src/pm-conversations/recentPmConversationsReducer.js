/* @flow strict-local */
import type { Action, RecentPrivateConversationsState } from '../types';
import { REALM_INIT } from '../actionConstants';
import { NULL_ARRAY } from '../nullObjects';

const initialState: RecentPrivateConversationsState = NULL_ARRAY;

const realmInit = (state, action) => {
  // If this is a pre-2.1 server, we'll have to get by without.
  if (action.data.recent_private_conversations === undefined) {
    return initialState;
  }

  // This part of the API provides lists of user IDs that never include the
  // self-user. For consistency with Message#display_recipient (and, therefore,
  // simplicity when using this data), we add them.
  const self_id: number = action.data.user_id;

  // Note that `user_ids` isn't guaranteed to be sorted prior to v2.1.2; even
  // if we weren't adding the self-user, we'd have to sort.
  return action.data.recent_private_conversations.map(({ user_ids, ...rest }) => ({
    ...rest,
    user_ids: user_ids.concat(self_id).sort((a, b) => a - b),
  }));
};

export default (
  state: RecentPrivateConversationsState = initialState,
  action: Action,
): RecentPrivateConversationsState => {
  switch (action.type) {
    case REALM_INIT:
      return realmInit(state, action);

    default:
      return state;
  }
};
