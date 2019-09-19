/* @flow strict-local */
import React, { PureComponent } from 'react';
import throttle from 'lodash.throttle';

import * as api from '../api';
import type { Auth, Message } from '../types';
import { Screen } from '../common';
import SearchMessagesCard from './SearchMessagesCard';
import styles from '../styles';
import { SEARCH_NARROW } from '../utils/narrow';
import { LAST_MESSAGE_ANCHOR } from '../constants';
import { connect } from '../react-redux';
import { getAuth } from '../account/accountsSelectors';

type Props = {|
  auth: Auth,
  // Warning: do not add new props without considering their effect on the
  // behavior of this component's non-React internal state. See comment below.
|};

type State = {|
  /** The list of messages returned for the latest query, or `null` if there is
   *  effectively no "latest query" to have results from.
   */
  messages: Message[] | null,
  /** Whether there is currently an active valid network request. */
  isFetching: boolean,
|};

class SearchMessagesScreen extends PureComponent<Props, State> {
  state = {
    messages: null,
    isFetching: false,
  };

  /** PRIVATE
   *  Performs a network request associated with a query. Does not
   *  update or access internal state (except `auth`).
   */
  performQueryRaw = async (query: string): Promise<Message[]> => {
    const { auth } = this.props;
    const { messages } = await api.getMessages(
      auth,
      SEARCH_NARROW(query),
      LAST_MESSAGE_ANCHOR,
      20,
      0,
      false,
    );
    return messages;
  };

  // Non-React state. See comment following.
  lastIdSent: number = 1000;
  lastIdReceived: number = 1000;

  // This component is less pure than it should be. The correct behavior here is
  // probably that, when props change, all outstanding asynchronous requests
  // should be **synchronously** invalidated before the next render.
  //
  // As the only React prop this component has is `auth`, we ignore this for
  // now: any updates to `auth` would involve this screen being torn down and
  // reconstructed anyway. However, addition of any new props which need to
  // invalidate outstanding requests on change will require more work.

  queryTrack: { [key: string]: number } = {};
  logQ = (query: string, msg: string) => {
    const now = Date.now();
    const timespan = now - this.queryTrack[query];
    console.log(`${now}: (${timespan.toString().padStart(3)}ms since ${query}): ${msg}`);
  };

  PERFORM_QUERY = 'PERFORM_QUERY';

  /** PRIVATE
   * Asynchronously performs a search query. Discards any responses thereto
   * which have been delayed long enough to be out-of-order.
   */
  performQuery = throttle(async (query: string) => {
    const last = this.queryTrack[this.PERFORM_QUERY];
    // eslint-disable-next-line no-multi-assign
    const now = (this.queryTrack[this.PERFORM_QUERY] = Date.now());
    this.logQ(query, `async performing query (${now - last}ms since last)`);
    const id = ++this.lastIdSent;

    this.setState({ isFetching: true });
    this.logQ(query, 'performing raw query');
    const messages = await this.performQueryRaw(query);
    this.logQ(query, 'performed raw query');
    await new Promise((y, n) => setTimeout(y, 500));
    this.logQ(query, 'completed artificial query delay');

    if (this.lastIdReceived > id) {
      return;
    }

    this.lastIdReceived = id;

    // A query is concluded. Report the message-list.
    this.logQ(query, 'pushing message state');
    this.setState({
      messages,
      isFetching: this.lastIdSent !== this.lastIdReceived,
    });
  }, 500);

  /** PRIVATE
   * Mark all outstanding network queries as invalid.
   */
  invalidateOutstandingQueries = () => {
    this.lastIdReceived = ++this.lastIdSent;
  };

  LAST_QUERY = 'LAST_QUERY';

  handleQueryChange = (query: string) => {
    // eslint-disable-next-line no-multi-assign
    const time = Date.now();
    const last = this.queryTrack[this.LAST_QUERY];
    this.queryTrack[query] = time;
    this.queryTrack[this.LAST_QUERY] = time;

    if (query === '') {
      // The empty query can be resolved without a network call.
      this.logQ(query, 'clearing all state');
      this.invalidateOutstandingQueries();
      this.setState({ messages: null, isFetching: false });
      return;
    }
    this.logQ(query, `handling query change (${time - last}ms since last)`);
    this.performQuery(query);
  };

  render() {
    const { messages, isFetching } = this.state;

    if (messages === null || messages.length === 0 || isFetching) {
      const time = Date.now();
      console.log(
        `${time} (${time - this.queryTrack[this.LAST_QUERY]}ms since last query): rendering`,
      );
    }

    const ret = (
      <Screen search autoFocus searchBarOnChange={this.handleQueryChange} style={styles.flexed}>
        <SearchMessagesCard messages={messages} isFetching={isFetching} />
      </Screen>
    );

    if (messages === null || messages.length === 0 || isFetching) {
      const time = Date.now();
      console.log(
        `${time} (${time - this.queryTrack[this.LAST_QUERY]}ms since last query): rendered`,
      );
    }

    return ret;
  }
}

export default connect(state => ({
  auth: getAuth(state),
}))(SearchMessagesScreen);
