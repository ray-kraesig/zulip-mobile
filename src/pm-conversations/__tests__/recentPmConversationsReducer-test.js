/* @flow strict-local */
import deepFreeze from 'deep-freeze';

import recentPmConversationsReducer from '../recentPmConversationsReducer';
import * as eg from '../../__tests__/lib/exampleData';

describe('recentPmConversationsReducer', () => {
  describe('EVENT_NEW_MESSAGE', () => {
    test('reorder correctly upon receiving a new message', () => {
      const self = eg.makeUser({ user_id: 0, name: 'me' });
      const john = eg.makeUser({ user_id: 1, name: 'john' });
      const mark = eg.makeUser({ user_id: 2, name: 'mark' });

      const self_and_john = Object.freeze([self.user_id, john.user_id].sort());
      const self_and_mark = Object.freeze([self.user_id, mark.user_id].sort());

      const newMessage = eg.pmMessageFromTo(mark, [self], { id: 2 });
      const initialState = deepFreeze([
        { max_message_id: 1, user_ids: self_and_john },
        { max_message_id: 0, user_ids: self_and_mark },
      ]);

      const action = deepFreeze({
        ...eg.eventNewMessageActionBase,
        message: newMessage,
      });

      expect(recentPmConversationsReducer(initialState, action)).toEqual([
        { max_message_id: 2, user_ids: self_and_mark },
        { max_message_id: 1, user_ids: self_and_john },
      ]);
    });
  });
});
