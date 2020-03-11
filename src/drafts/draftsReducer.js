/* @flow strict-local */
import type { DraftsState, Action } from '../types';
import type {
  DraftUpdateAction,
} from '../actionTypes';
import { DRAFT_UPDATE, LOGOUT, ACCOUNT_SWITCH } from '../actionConstants';
import { NULL_OBJECT } from '../nullObjects';

const initialState = NULL_OBJECT;

const draftUpdate = (state: DraftsState, action: DraftUpdateAction): DraftsState => {
  const narrowStr = JSON.stringify(action.narrow);

  if (action.content.trim().length === 0) {
    // New content is blank; delete the draft.
    if (!state[narrowStr]) {
      return state;
    }
    const newState = { ...state };
    delete newState[narrowStr];
    return newState;
  }

  return state[narrowStr] === action.content ? state : { ...state, [narrowStr]: action.content };
};

export default (state: DraftsState = initialState, action: Action): DraftsState => {
  switch (action.type) {
    case LOGOUT:
    case ACCOUNT_SWITCH:
      return initialState;

    case DRAFT_UPDATE:
      return draftUpdate(state, action);

    default:
      return state;
  }
};
