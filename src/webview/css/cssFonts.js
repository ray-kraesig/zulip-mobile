/* @flow strict-local */

import escape from 'lodash.escape';

import FontAwesome from 'react-native-vector-icons/FontAwesome';
import type { FontAwesomeGlyphs } from 'react-native-vector-icons/FontAwesome';

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
