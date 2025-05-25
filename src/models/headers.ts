import { RequestInit } from '../types';

/**
 * The accepted initializer types.
 */
export type HeadersInit =
  | Headers
  | Record<string, string | string[]>
  | Iterable<readonly [string, string | number | string[]]>
  | Iterable<Iterable<string>>;

export default class CustomHeaders extends Headers {
  constructor(init?: HeadersInit) {
    // Start with an empty Headers instance.
    super();
    if (init) {
      if (init instanceof Headers && typeof (init as any).raw === 'function') {
        const rawInit = (init as any).raw();
        for (const [name, values] of Object.entries(rawInit)) {
          for (const value of values as string[]) {
            this.append(name, value);
          }
        }
      } else if (init instanceof Headers) {
        for (const [name, value] of init.entries()) {
          this.append(name, value);
        }
      } else if (typeof init === 'object') {
        const iterator = (init as any)[Symbol.iterator];
        if (typeof iterator === 'function') {
          for (const pair of init as Iterable<any>) {
            const [name, value] = Array.from(pair);
            this.append(name as string, String(value));
          }
        } else {
          for (const [name, value] of Object.entries(init)) {
            if (Array.isArray(value)) {
              for (const v of value) {
                this.append(name, String(v));
              }
            } else {
              this.append(name, String(value));
            }
          }
        }
      } else {
        throw new TypeError(
          "[BunCurl2] - Failed to construct 'Headers': The provided value is not a valid headers object",
        );
      }
    }
  }

  /**
   * Returns all headers as an object mapping each header name to an array of values.
   */
  raw(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, values] of this.entries()) {
      result[key] = key in result ? [...result[key], values] : [values];
    }
    return result;
  }
}

const prioritizedOrder = new Map<string, number>(
  [
    'accept',
    'accept-charset',
    'accept-encoding',
    'accept-language',
    'access-control-request-headers',
    'access-control-request-method',
    'authorization',
    'cache-control',
    'connection',
    'content-length',
    'content-type',
    'cookie',
    'dnt',
    'expect',
    'host',
    'if-match',
    'if-modified-since',
    'if-none-match',
    'if-range',
    'if-unmodified-since',
    'keep-alive',
    'origin',
    'pragma',
    'proxy-authorization',
    'range',
    'referer',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-websocket-extensions',
    'sec-websocket-key',
    'sec-websocket-protocol',
    'sec-websocket-version',
    'te',
    'upgrade-insecure-requests',
    'user-agent',
  ].map((header, index) => [header, index]),
);

export function sortHeaders(
  inputHeaders: Exclude<RequestInit['headers'], undefined>,
): [string, string][] {
  let headerEntries: [string, string, string][];

  if (inputHeaders instanceof Headers) {
    headerEntries = Array.from(inputHeaders, ([key, value]) => [
      key,
      key.toLowerCase(),
      value,
    ]);
  } else if (Array.isArray(inputHeaders)) {
    headerEntries = inputHeaders.map(
      ([key, value]) =>
        [key, key.toLowerCase(), String(value)] as [string, string, string],
    );
  } else {
    headerEntries = Object.entries(inputHeaders).map(
      ([key, value]) =>
        [key, key.toLowerCase(), String(value)] as [string, string, string],
    );
  }

  headerEntries.sort((a, b) => {
    const indexA = prioritizedOrder.get(a[1]);
    const indexB = prioritizedOrder.get(b[1]);

    if (indexA !== undefined && indexB !== undefined) {
      return indexA - indexB;
    }
    if (indexA !== undefined) {
      return -1;
    }
    if (indexB !== undefined) {
      return 1;
    }
    return a[1].localeCompare(b[1]);
  });

  return headerEntries.map(([original, , value]) => [original, value]);
}
