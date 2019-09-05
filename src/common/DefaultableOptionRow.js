/* @flow strict-local */
import React, { PureComponent } from 'react';
import { View, SegmentedControlIOS, Picker } from 'react-native';
import type { ViewStyleProp } from 'react-native/Libraries/StyleSheet/StyleSheet';

import type { IconType } from './Icons';
import Label from './Label';
import type { ThemeColors } from '../styles';
import styles, { ThemeContext } from '../styles';

type Props = {|
  Icon?: IconType,
  label: string,
  value: boolean | null,
  style?: ViewStyleProp,
  onValueChange: (newValue: boolean | null) => void,
|};

// fixed at [On | Default | Off]
export default class DefaultableOptionRow extends PureComponent<Props> {
  static contextType = ThemeContext;
  context: ThemeColors;

  styles = {
    icon: {
      ...styles.settingsIcon,
      color: this.context.color,
    },
  };

  // received from SegmentedControlIOS
  onValueChangeIOS = (event: Event) => {
    // needs assertions
    /* const index: number = event.target.value;
    const newValue = [false, null, true][index];
    this.props.onValueChange(newValue); */
  };

  static valueConverter = {
    null: null,
    true: true,
    false: false,
  };
  onValueChange = (value: string | number) => {
    // const { value } = event.target;
    const { valueConverter } = DefaultableOptionRow;

    const newValue: boolean | null = value in valueConverter ? valueConverter[value] : null;

    this.props.onValueChange(newValue);
  };

  render() {
    const { label, value, style, Icon } = this.props;

    return (
      <View style={[styles.listItem, style]}>
        {!!Icon && <Icon size={18} style={this.styles.icon} />}
        <Label text={label} style={styles.flexed} />
        <View style={styles.rightItem}>
          <SegmentedControlIOS
            values={['On', 'Default', 'Off']}
            selected={value == null ? 1 : value ? 2 : 0}
            onValueChange={this.onValueChangeIOS}
          />
          <Picker
            selectedValue={value == null ? 'null' : value ? 'true' : 'false'}
            onValueChange={this.onValueChange}
          >
            <Picker.Item label="Default" value="null" />
            <Picker.Item label="Override: On" value="true" />
            <Picker.Item label="Override: Off" value="false" />
          </Picker>
        </View>
      </View>
    );
  }
}
