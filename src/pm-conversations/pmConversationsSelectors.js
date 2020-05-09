/* @flow strict-local */
import { createSelector } from 'reselect';

import type {
  Message,
  PmConversationData,
  RecentPrivateConversation,
  Selector,
  User,
  UserOrBot,
} from '../types';
import { getServerVersion } from '../account/accountsSelectors';
import { getPrivateMessages } from '../message/messageSelectors';
import { getRecentPrivateConversations } from '../directSelectors';
import { getOwnUser, getAllUsersById } from '../users/userSelectors';
import { getUnreadByPms, getUnreadByHuddles } from '../unread/unreadSelectors';
import { normalizeRecipientsSansMe, pmUnreadsKeyFromAllUserIds } from '../utils/recipient';
import { ZulipVersion } from '../utils/zulipVersion';

/** Intermediate data denoting a single user. Slice of the model type PmRecipientUser. */
type PmRecipientFragment = { email: string, user_id: number, ... };
type PmConversationFragment = {| recipients: PmRecipientFragment[], msgId: number |};

/**
 * Legacy implementation of {@link getRecentConversations}. Computes an
 * approximation to the set of recent conversations, based on the messages we
 * already know about.
 */
const getRecentConversationsLegacyImpl: Selector<PmConversationFragment[]> = createSelector(
  getOwnUser,
  getPrivateMessages,
  (ownUser: User, messages: Message[]): PmConversationFragment[] => {
    // arbitrary "hash" for display_recipient (must not escape this function!)
    const makeKey = (msg: Message) =>
      msg.display_recipient
        .map(s => s.user_id)
        .sort((a, b) => a - b)
        .join('\t');

    // remember only most recent message for each conversation
    const latestByRecipient = new Map<string, PmConversationFragment>();
    messages.forEach(msg => {
      const key = makeKey(msg);
      const prev = latestByRecipient.get(key);
      if (!prev || msg.id > prev.msgId) {
        latestByRecipient.set(key, { recipients: msg.display_recipient, msgId: msg.id });
      }
    });

    // sort by most recent
    return Array.from(latestByRecipient.values()).sort((a, b) => +b.msgId - +a.msgId);
  },
);

/**
 * Modern implementation of {@link getRecentConversations}. Returns exactly the
 * most recent conversations. Requires server-side support.
 */
const getRecentConversationsImpl: Selector<PmConversationFragment[]> = createSelector(
  getOwnUser,
  getAllUsersById,
  getRecentPrivateConversations,
  (
    ownUser: User,
    allUsers: Map<number, UserOrBot>,
    recentPCs: RecentPrivateConversation[],
  ): PmConversationFragment[] => {
    const getEmail = (id: number): string => {
      const user = allUsers.get(id);
      if (user) {
        return user.email;
      }
      throw new Error('getRecentConversations: unknown user id');
    };

    return recentPCs.map(conversation => {
      const userIds = conversation.user_ids.slice();
      return {
        recipients: userIds.map(id => ({ user_id: id, email: getEmail(id) })),
        msgId: conversation.max_message_id,
      };
    });
  },
);

/**
 * The server version in which 'recent_private_conversations' was first made
 * available.
 */
const DIVIDING_LINE = new ZulipVersion('2.1-dev-384-g4c3c669b41');

/**
 * Get a list of the most recent private conversations, including the most
 * recent message from each.
 */
// TODO: don't compute `legacy` when `version` indicates it's unneeded
export const getRecentConversations: Selector<PmConversationData[]> = createSelector(
  getRecentConversationsImpl,
  getRecentConversationsLegacyImpl,
  getServerVersion,
  getOwnUser,
  getUnreadByPms,
  getUnreadByHuddles,
  (
    modern,
    legacy,
    version: ZulipVersion | null,
    ownUser: User,
    unreadPms: { [number]: number },
    unreadHuddles: { [string]: number },
  ) => {
    const isNewServer: boolean = version ? version.isAtLeast(DIVIDING_LINE) : false;

    // prettier-ignore
    const recentPCs: PmConversationFragment[] = isNewServer
      // If we're talking to a new enough version of the Zulip server, we don't
      // need the legacy impl; the modern one will always return a superset of
      // its content.
      ? modern
      // If we're _not_ talking to a newer version of the Zulip server, then
      // there's no point in using the modern version; it will only return
      // messages received in the current session, which should all be in the
      // legacy impl's data as well.
      : legacy;

    const items = recentPCs.map(conversation => {
      const userIds = conversation.recipients.map(s => s.user_id);
      return {
        ids: pmUnreadsKeyFromAllUserIds(userIds, ownUser.user_id),
        recipients: normalizeRecipientsSansMe(conversation.recipients, ownUser.email),
        msgId: conversation.msgId,
      };
    });

    return items.map(recipient => ({
      ...recipient,
      unread:
        // This business of looking in one place and then the other is kind
        // of messy.  Fortunately it always works, because the key spaces
        // are disjoint: all `unreadHuddles` keys contain a comma, and all
        // `unreadPms` keys don't.
        /* $FlowFixMe: The keys of unreadPms are logically numbers, but because it's an object they
         end up converted to strings, so this access with string keys works.  We should probably use
         a Map for this and similar maps. */
        unreadPms[recipient.ids] || unreadHuddles[recipient.ids],
    }));
  },
);

export const getUnreadConversations: Selector<PmConversationData[]> = createSelector(
  getRecentConversations,
  conversations => conversations.filter(c => c.unread > 0),
);
