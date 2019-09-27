/** @jest-environment jest-environment-jsdom */
/* @flow strict-local */

import type { FontAwesomeGlyphs } from 'react-native-vector-icons/FontAwesome';

import { getFontAwesomeGlyph, getFontAwesomeSpan } from '../css/cssFonts';
import css from '../css/css';

describe('cssFonts', () => {
  // These tests are mostly approximative. More correctly, we should parse the
  // HTML and CSS fragments we're looking at, rather than just hacking at them
  // with regexes.

  ['default', 'night'].forEach(themeName => {
    test(`FontAwesome's CSS class is available in theme '${themeName}'`, () => {
      const cssText = css(themeName);
      expect(cssText).toMatch(/@font-face\s*{[^}]*font-family:\s*'FontAwesome'/);
      expect(cssText).toMatch(/fa\s*{[^}]*font-family:\s*'FontAwesome'/);
    });
  });

  test('we can get raw FontAwesome glyphs', () => {
    getFontAwesomeGlyph('dot-circle-o');
  });

  test("glyphs are single characters from the BMP's Private Use Area", () => {
    const glyph = getFontAwesomeGlyph('space-shuttle');
    expect(typeof glyph).toBe('string');
    expect(glyph.length).toBe(1);

    const codepoint: number = glyph.charCodeAt(0);
    expect(codepoint).toBeGreaterThanOrEqual(0xe000);
    expect(codepoint).toBeLessThanOrEqual(0xf8ff);
  });

  // FontAwesome 4 is effectively frozen, so this value shouldn't change. (We
  // don't require this value in the app, but it's a conveniently-fixed bit of
  // data to test against.)
  test("FontAwesome's star is a known glyph", () => {
    const glyph = getFontAwesomeGlyph('star');
    // https://fontawesome.com/v4.7.0/icon/star
    expect(glyph).toBe('\uf005');
  });

  describe('getFontAwesomeSpan', () => {
    const parseFragment = (s: string): HTMLElement => {
      const node = document.createElement('a');
      node.innerHTML = s;
      expect(node.children.length).toBe(1);
      return node.children[0];
    };

    const starSpan: string = getFontAwesomeSpan('star');
    const starFrag: HTMLElement = parseFragment(starSpan);

    test('spans contain the associated glyph', () => {
      const glyphNames: FontAwesomeGlyphs[] = [
        'sort-desc',
        'sort-numeric-asc',
        'sort-numeric-desc',
        'space-shuttle',
        'spinner',
        'spoon',
        'square',
        'square-o',
        'star',
      ];
      glyphNames.forEach(glyphName => {
        const glyph = getFontAwesomeGlyph(glyphName);
        const span = parseFragment(getFontAwesomeSpan(glyphName));
        expect(span.textContent).toContain(glyph);
      });
    });

    test('spans contain a reference to the FontAwesome CSS class', () => {
      expect(starFrag.classList).toContain('fa');
    });

    test('spans contain other classes passed in', () => {
      const classes = 'ant bee cat dog elk fly gnu'.split(' ');
      const frag = parseFragment(getFontAwesomeSpan('star', { classes }));

      classes.forEach((className: string) => {
        expect(frag.classList).toContain(className);
      });
    });

    test('spans contain other attributes passed in', () => {
      const attributes = { style: 'display: none', 'data-extra': '1234567' };
      const frag = parseFragment(getFontAwesomeSpan('star', { attributes }));

      expect(frag.style.display).toBe('none');
      expect(frag.dataset.extra).toBe('1234567');
    });
  });
});
