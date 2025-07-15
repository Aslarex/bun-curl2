import { RequestInit } from '../types';

export type HeadersInit =
  | Headers
  | Record<string, string | string[]>
  | Iterable<readonly [string, string | number | string[]]>
  | Iterable<Iterable<string>>;

const prioritizedOrderLookup: Record<string, number> = Object.freeze({
  accept: 0,
  'accept-charset': 1,
  'accept-encoding': 2,
  'accept-language': 3,
  'access-control-request-headers': 4,
  'access-control-request-method': 5,
  authorization: 6,
  'cache-control': 7,
  connection: 8,
  'content-length': 9,
  'content-type': 10,
  cookie: 11,
  dnt: 12,
  expect: 13,
  host: 14,
  'if-match': 15,
  'if-modified-since': 16,
  'if-none-match': 17,
  'if-range': 18,
  'if-unmodified-since': 19,
  'keep-alive': 20,
  origin: 21,
  pragma: 22,
  'proxy-authorization': 23,
  range: 24,
  referer: 25,
  'sec-fetch-dest': 26,
  'sec-fetch-mode': 27,
  'sec-websocket-extensions': 28,
  'sec-websocket-key': 29,
  'sec-websocket-protocol': 30,
  'sec-websocket-version': 31,
  te: 32,
  'upgrade-insecure-requests': 33,
  'user-agent': 34,
});

export default class CustomHeaders extends Headers {
  constructor(init?: HeadersInit) {
    super();
    if (!init) return;

    if (init instanceof CustomHeaders && typeof init.raw === 'function') {
      const raw = init.raw() as Record<string, string[]>;
      for (const name in raw) {
        const values = raw[name];
        for (let i = 0; i < values.length; i++) {
          super.append(name, values[i]);
        }
      }
      return;
    }

    const it = (init as any)[Symbol.iterator];
    if (typeof it === 'function') {
      for (const pair of init as Iterable<any>) {
        super.append(pair[0], String(pair[1]));
      }
      return;
    }

    for (const name in init as Record<string, string | string[]>) {
      const val = (init as Record<string, any>)[name];
      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          super.append(name, String(val[i]));
        }
      } else {
        super.append(name, String(val));
      }
    }
  }

  raw(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [k, v] of this) {
      const key = k.toLowerCase();
      if (out[key]) out[key].push(v);
      else out[key] = [v];
    }
    return out;
  }
}

export function sortHeaders(
  inputHeaders: Exclude<RequestInit['headers'], undefined>,
): [string, string][] {
  let arr: [string, string, string][];

  if (inputHeaders instanceof Headers) {
    arr = [];
    for (const [k, v] of inputHeaders) {
      arr.push([k, k.toLowerCase(), v]);
    }
  } else if (Array.isArray(inputHeaders)) {
    arr = new Array(inputHeaders.length);
    for (let i = 0; i < inputHeaders.length; i++) {
      const [k, v] = inputHeaders[i];
      arr[i] = [k, k.toLowerCase(), String(v)];
    }
  } else {
    const keys = Object.keys(inputHeaders);
    arr = new Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const val = (inputHeaders as Record<string, any>)[k];
      arr[i] = [k, k.toLowerCase(), String(val)];
    }
  }

  arr.sort((a, b) => {
    const ia = prioritizedOrderLookup[a[1]];
    const ib = prioritizedOrderLookup[b[1]];
    if (ia !== undefined && ib !== undefined) return ia - ib;
    if (ia !== undefined) return -1;
    if (ib !== undefined) return 1;
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });

  const out = new Array<[string, string]>(arr.length);
  for (let i = 0; i < arr.length; i++) {
    out[i] = [arr[i][0], arr[i][2]];
  }
  return out;
}
