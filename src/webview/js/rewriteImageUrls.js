/* @flow strict-local */

import type { Auth } from '../../types';

// Ponyfill for URL.origin (Chrome 52, Safari 10).
const origin = (url: URL) => {
  if (url.origin) {
    return url.origin;
  }
  const { href, pathname, search, hash } = url;
  return href.slice(0, href.length - pathname.length - search.length - hash.length);
};

// Parse URL into origin and path-plus-search.
const splitUrl = (url: URL): { head: string, rest: string } => {
  const head = origin(url);
  const rest = url.href.slice(head.length);
  return { head, rest };
};

/** List of routes which accept the API key appended as a GET parameter. */
const inlineApiRoutes: string[] = ['/user_uploads/', '/thumbnail?', '/avatar/'];

/**
 * Rewrite the source URLs of <img> tags beneath the specified parent element:
 *
 *   1. Make relative URLs absolute, with a path based on the Zulip realm rather
 *      than the document location.
 *   2. If the source URL names an endpoint known to require authentication,
 *      inject an API key into its query parameters.
 */
const rewriteImageUrls = (auth: Auth, element: Element) => {
  // The realm, parsed.
  const realm: URL = new URL(auth.realm);

  // Extract all image tags including and/or beneath `element`.
  const imageTags: $ReadOnlyArray<HTMLImageElement> = [].concat(
    element instanceof HTMLImageElement ? [element] : [],
    Array.from(element.getElementsByTagName('img')),
  );

  // Process each image tag.
  imageTags.forEach(img => {
    // Get the raw `src` value from the DOM. (We can't easily use `img.src`,
    // since it's absolutized by the browser.)
    /* $FlowFixMe (upstream 'getNamedItem' is mistyped) */
    const actualSrc: string | null = img.attributes.getNamedItem('src')?.value;

    // Skip completely sourceless elements: they're someone else's problem.
    if (actualSrc === null) {
      return;
    }

    // Compute the absolute URL as though `auth.realm` were the basis.
    // Break it into `origin` and `path` components.
    const fixedSrc: URL = new URL(actualSrc, realm);
    const { head: fixedOrigin, rest: fixedPath } = splitUrl(fixedSrc);

    // If the corrected URL is on this realm...
    if (fixedOrigin === origin(realm)) {
      // ... check to see if it's a route that needs the API key...
      if (inlineApiRoutes.some(route => fixedPath.startsWith(route))) {
        // ... and append it, if so.
        const delimiter = actualSrc.includes('?') ? '&' : '?';
        fixedSrc.search += `${delimiter}api_key=${auth.apiKey}`;
      }
    }

    // Apply effective changes, if any.
    if (img.src !== fixedSrc.href) {
      img.src = fixedSrc.href;
    }
  }); /* for each img */
};

export default rewriteImageUrls;
