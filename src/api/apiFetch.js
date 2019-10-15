/* @flow strict-local */
import type { UrlParams } from '../utils/url';
import type { Auth } from './transportTypes';
import { getAuthHeaders } from './transport';
import { encodeParamsForUrl, isValidUrl } from '../utils/url';
import userAgent from '../utils/userAgent';
import { networkActivityStart, networkActivityStop } from '../utils/networkActivity';
import { makeErrorFromApi } from './apiErrors';
import store from '../boot/store';
import { getSettings } from '../directSelectors';

const apiVersion = 'api/v1';

export const objectToParams = (obj: {}) => {
  const newObj = {};
  Object.keys(obj).forEach(key => {
    if (Array.isArray(obj[key])) {
      newObj[key] = JSON.stringify(obj[key]);
    } else if (obj[key] === undefined) {
      // do nothing, skip key
    } else {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

export const getFetchParams = (auth: Auth, params: {} = {}) => {
  // $FlowFixMe This is purely a no-op, and Flow even knows that. :-/
  const { body } = (params: { body?: mixed });
  const contentType =
    body instanceof FormData
      ? 'multipart/form-data'
      : 'application/x-www-form-urlencoded; charset=utf-8';

  // HACK: access Redux store directly.
  //
  // In future, rather than passing the Auth around as transparent data, the
  // Auth and the locale will likely be bound together into a single object with
  // appropriate methods.
  const { locale } = getSettings(store.getState());

  return {
    headers: {
      'Content-Type': contentType,
      'User-Agent': userAgent,
      'Accept-Language': locale,
      ...getAuthHeaders(auth),
    },
    ...params,
  };
};

export const fetchWithAuth = async (auth: Auth, url: string, params: {} = {}) => {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid url ${url}`);
  }

  return fetch(url, getFetchParams(auth, params));
};

export const apiFetch = async (auth: Auth, route: string, params: {} = {}) =>
  fetchWithAuth(auth, `${auth.realm}/${apiVersion}/${route}`, params);

export const apiCall = async (
  auth: Auth,
  route: string,
  params: {} = {},
  isSilent: boolean = false,
) => {
  try {
    networkActivityStart(isSilent);
    const response = await apiFetch(auth, route, params);
    const json = await response.json().catch(() => undefined);
    if (response.ok && json !== undefined) {
      return json;
    }
    // eslint-disable-next-line no-console
    console.log({ route, params, httpStatus: response.status, json });
    throw makeErrorFromApi(response.status, json);
  } finally {
    networkActivityStop(isSilent);
  }
};

export const apiGet = async (
  auth: Auth,
  route: string,
  params: UrlParams = {},
  isSilent: boolean = false,
) =>
  apiCall(
    auth,
    `${route}?${encodeParamsForUrl(params)}`,
    {
      method: 'get',
    },
    isSilent,
  );

export const apiPost = async (auth: Auth, route: string, params: UrlParams = {}) =>
  apiCall(auth, route, {
    method: 'post',
    body: encodeParamsForUrl(params),
  });

export const apiFile = async (auth: Auth, route: string, body: FormData) =>
  apiCall(auth, route, {
    method: 'post',
    body,
  });

export const apiPut = async (auth: Auth, route: string, params: UrlParams = {}) =>
  apiCall(auth, route, {
    method: 'put',
    body: encodeParamsForUrl(params),
  });

export const apiDelete = async (auth: Auth, route: string, params: UrlParams = {}) =>
  apiCall(auth, route, {
    method: 'delete',
    body: encodeParamsForUrl(params),
  });

export const apiPatch = async (auth: Auth, route: string, params: UrlParams = {}) =>
  apiCall(auth, route, {
    method: 'patch',
    body: encodeParamsForUrl(params),
  });

export const apiHead = async (auth: Auth, route: string, params: UrlParams = {}) =>
  apiCall(auth, `${route}?${encodeParamsForUrl(params)}`, {
    method: 'head',
  });
