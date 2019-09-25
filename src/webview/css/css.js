/* @flow strict-local */
import type { ThemeName } from '../../types';
import cssBase from './cssBase';
import cssPygments from './cssPygments';
import cssEmojis from './cssEmojis';
import cssNight from './cssNight';

export default (theme: ThemeName) => `
<style>
${cssBase}
${theme === 'night' ? cssNight : ''}
${cssPygments(theme === 'night')}
${cssEmojis}
</style>
<style id="style-hide-js-error-plain">
#js-error-plain, #js-error-plain-dummy {
  display: none;
}
</style>
<style id="generated-styles"></style>
`;
