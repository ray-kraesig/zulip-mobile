// @flow strict-local
import { createSelector } from 'reselect';

import { type ThemeColors, themeColors } from './theme';
import type { GlobalState, Selector, ThemeName } from '../types';

export const getThemeColors: Selector<ThemeColors> = createSelector(
  (state: GlobalState) => state.settings.theme,
  (theme: ThemeName) => themeColors[theme],
);
