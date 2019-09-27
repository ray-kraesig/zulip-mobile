/* @flow strict-local */

import escape from 'lodash.escape';
import { Platform } from 'react-native';

import FontAwesome from 'react-native-vector-icons/FontAwesome';
import type { FontAwesomeGlyphs } from 'react-native-vector-icons/FontAwesome';

// import Feather from 'react-native-vector-icons/Feather';
// import type { FeatherGlyphs } from 'react-native-vector-icons/Feather';

const cssFontDir: string = Platform.select({
  ios: 'file:///assets/fonts', // UNTESTED
  android: 'file:///android_asset/fonts',
});

export type MakeCssFontDeclOptions = {|
  /** Font filename. Deduced from the font name if not supplied. */
  fontFile: string,
  /** Name of a CSS class that will be created which, if applied to an element,
      will select this font within it. Omitted if not supplied. */
  className: string,
|};

/** Regex matching a valid, permitted CSS class name.
 *
 * Rejects names with an initial hyphen. (These are technically allowed by the
 * standard, but are reserved to implementation vendors.)
 */
// (The actual CSS standard's rules are much more complex than this: they
// even allow for inline control characters, with some escaping.)
const cssClassRegex: RegExp = /[_a-zA-Z]+[_-a-zA-Z0-9]*/;

/**
 * Generate CSS to load and name a font.
 *
 * Not currently used for anything but FontAwesome.
 */
const makeCssFontDecl = (
  fontName: string,
  options: $Shape<MakeCssFontDeclOptions> = {},
): string => {
  const fileName: string = options.fontFile ?? `${fontName}.ttf`;

  // check that options.className is a valid CSS class name
  if (!cssClassRegex.test(options.className)) {
    throw new Error(`invalid CSS class name '${options.className}' for font '${fontName}'`);
  }
  // Flow should complain about this line, since it can't know we've eliminated
  // the empty string from options.className's possible values. In some future
  // version, it probably will complain.
  const fontClass: string = options.className
    ? `\n.${options.className} { font-family: '${fontName}' }`
    : '';

  return `@font-face {
  font-family: '${fontName}';
  src: local('${fontName}'), url("${cssFontDir}/${fileName}") format("truetype");
}${fontClass}
`;
};

/** Inline CSS text defining all commonly-used additional fonts. */
export const cssCommonFonts: string = [
  ['FontAwesome', { className: 'fa' }],
  // ['Feather', { className: 'fth' }],
]
  .map(fontDesc => makeCssFontDecl(...fontDesc))
  .join('');

/**
 * Given the name of a FontAwesome glyph, return the glyph as a string.
 *
 * This will be a single codepoint from the Private Use Area; it will not be
 * suitable for display in most contexts.
 */
export const getFontAwesomeGlyph = (which: FontAwesomeGlyphs): string => {
  // As of RNVI v6.6.0, Flow presently believes that `raw` is just `number`.
  // (This may be true for FontAwesome in particular, but is not generally true.)
  const raw: string | number = FontAwesome.getRawGlyphMap()[which];
  return typeof raw === 'number' ? String.fromCodePoint(raw) : raw;
};

/**
 * Given the name of a FontAwesome glyph, return an HTML span containing it,
 * with appropriate styling.
 *
 * The caller may specify a list of additional classes which will also be
 * applied to the span.
 */
export const getFontAwesomeSpan = (
  which: FontAwesomeGlyphs,
  { classes, attributes }: {| classes?: string[], attributes?: { [string]: string } |} = {},
): string => {
  const escapedGlyph = `&#x${getFontAwesomeGlyph(which)
    .codePointAt(0)
    .toString(16)};`;

  const classesStr = ['fa'].concat(classes ?? []).join(' ');

  const attrsStr = attributes
    ? Object.keys(attributes)
        .map(k => `${k}="${escape(attributes[k])}"`)
        .join(' ')
    : '';

  return `<span class="${classesStr}"${attrsStr}>${escapedGlyph}</span>`;
};
