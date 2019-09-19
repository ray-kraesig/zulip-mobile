/* @flow strict-local */
import React, { PureComponent } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
// import type { TextInputEvent } from 'react-native/Libraries/Components/';

import Input from './Input';
import type { Props as InputProps } from './Input';
import styles, { BRAND_COLOR } from '../styles';
import { Icon } from './Icons';

const componentStyles = StyleSheet.create({
  clearButtonIcon: {
    color: BRAND_COLOR,
    paddingRight: 16,
  },
});

type Props = $Diff<InputProps, { textInputRef: mixed, value: mixed }>;

type State = {|
  canBeCleared: boolean,
  text: string,
|};

/**
 * A component wrapping Input and providing an 'X' button
 * to clear the entered text.
 *
 * All props are passed through to `Input`.  See `Input` for descriptions.
 */
export default class InputWithClearButton extends PureComponent<Props, State> {
  state = {
    canBeCleared: false,
    text: '',
  };
  textInput: ?TextInput;

  handleChangeText = (text: string) => {
    this.setState({
      canBeCleared: text.length > 0,
      text,
    });
    if (this.props.onChangeText) {
      console.log(`${Date.now()}: sending change signal for ${text}`);
      this.props.onChangeText(text);
    }
  };

  handleClear = () => {
    this.handleChangeText('');
    if (this.textInput) {
      this.textInput.clear();
    }
  };

  /* onSomeEvent = (name: string) => (event: {}) => {
    const evstr = JSON.stringify(Object.keys(event));
    console.log(`${Date.now()}: ${name}: ${evstr}`);
  }; */

  render() {
    const { canBeCleared, text } = this.state;

    return (
      <View style={styles.row}>
        <Input
          {...this.props}
          textInputRef={textInput => {
            this.textInput = textInput;
          }}
          /* onTextInput={this.onSomeEvent('onTextInput')}
          onChange={this.onSomeEvent('onChange')}
          onEndEditing={this.onSomeEvent('onEndEditing')}
          onKeyPress={this.onSomeEvent('onKeyPress')} */
          onChangeText={this.handleChangeText}
          value={text}
        />
        {canBeCleared && (
          <Icon
            name="x"
            size={24}
            onPress={this.handleClear}
            style={componentStyles.clearButtonIcon}
          />
        )}
      </View>
    );
  }
}
