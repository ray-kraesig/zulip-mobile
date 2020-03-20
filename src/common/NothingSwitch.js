// @flow strict-local
/* eslint-disable no-console */

/* ******************************************************** */
/* *********** FOR TESTING ONLY -- DO NOT MERGE *********** */
/* ******************************************************** */

import React, { PureComponent } from 'react';

import type { Dispatch } from '../types';
import { connect } from '../react-redux';
import { OptionRow } from '.';
import { sleep } from '../utils/async';

type Props = {|
  +dispatch: Dispatch,
  +name: string,
|};

type State = {|
  value: boolean,
|};

class NothingSwitch extends PureComponent<Props, State> {
  state: State = { value: true };

  name() {
    return `NothingSwitch for ${this.props.name}`;
  }

  handleToggle = async (value: boolean) => {
    console.log({
      where: this.name(),
      what: `handleToggle(${value ? 'true' : 'false'})`,
      time: Date.now(),
    });
    await sleep(500);
    this.setState({ value });
  };

  render() {
    console.log({
      where: this.name(),
      what: 'render',
      time: Date.now(),
    });
    return (
      <OptionRow
        label="Do nothing"
        value={this.state.value}
        onValueChange={v => {
          this.handleToggle(v);
        }}
      />
    );
  }
}

export default connect()(NothingSwitch);
