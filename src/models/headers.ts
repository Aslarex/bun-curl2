import { types } from 'node:util';

/**
 * Validate header name using Node’s built‐in validator if available,
 * otherwise falling back to a RegExp check.
 */
const validateHeaderName = (name: string): void => {
  if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name)) {
    const error = new TypeError(
      `[BunCurl2] - Header name must be a valid HTTP token [${name}]`,
    );
    Object.defineProperty(error, 'code', {
      value: 'ERR_INVALID_HTTP_TOKEN',
    });
    throw error;
  }
};

/**
 * Validate header value using Node’s built‐in validator if available,
 * otherwise falling back to a RegExp check.
 */
const validateHeaderValue = (name: string, value: string): void => {
  if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
    const error = new TypeError(
      `[BunCurl2] - Invalid character in header content ["${name}"]`,
    );
    Object.defineProperty(error, 'code', {
      value: 'ERR_INVALID_CHAR',
    });
    throw error;
  }
};

/**
 * The accepted initializer types.
 */
export type HeadersInit =
  | Headers
  | Record<string, string | string[]>
  | Iterable<readonly [string, string | string[]]>
  | Iterable<Iterable<string>>;

/**
 * A Headers class that mimics node‑fetch’s implementation.
 *
 * It extends URLSearchParams and returns a Proxy that intercepts methods
 * such as append, set, delete, has, getAll, and keys to automatically validate
 * and normalize header names.
 *
 * Additionally, we override the iterator methods. Since URLSearchParams in
 * Node.js returns “rich” iterators (with extra methods like map/filter),
 * we cast our generator results to the proper return types.
 */
export default class Headers extends URLSearchParams {
  constructor(init?: HeadersInit) {
    let result: string[][] = [];

    if (init instanceof Headers) {
      // When initializing from another Headers instance,
      // use its raw() method which already returns lower-cased keys.
      const raw = init.raw();
      for (const [name, values] of Object.entries(raw)) {
        result.push(...values.map(value => [name, value]));
      }
    } else if (init == null) {
      // No initializer – result remains empty.
    } else if (typeof init === 'object' && !types.isBoxedPrimitive(init)) {
      const method = (init as any)[Symbol.iterator];
      if (method == null) {
        // Plain object: Record<string, string>
        result.push(...Object.entries(init as Record<string, string>));
      } else {
        if (typeof method !== 'function') {
          throw new TypeError('[BunCurl2] - Header pairs must be iterable');
        }
        // Iterable – exhaust, validate, and ensure each pair is [name, value]
        result = [...(init as Iterable<any>)]
          .map(pair => {
            if (typeof pair !== 'object' || types.isBoxedPrimitive(pair)) {
              throw new TypeError(
                '[BunCurl2] - Each header pair must be an iterable object',
              );
            }
            return [...pair] as string[];
          })
          .map(pair => {
            if (pair.length !== 2) {
              throw new TypeError(
                '[BunCurl2] - Each header pair must be a name/value tuple',
              );
            }
            return pair;
          });
      }
    } else {
      throw new TypeError(
        "[BunCurl2] - Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)'",
      );
    }

    // **Key difference:** Normalize all header names to lower-case
    if (result.length > 0) {
      result = result.map(([name, value]) => {
        validateHeaderName(name);
        validateHeaderValue(name, String(value));
        return [String(name).toLowerCase(), String(value)];
      });
    }

    // Pass the normalized array to URLSearchParams
    super(result);

    // Return a Proxy to automatically validate and lowercase header names on method calls.
    return new Proxy(this, {
      get(target, prop, receiver) {
        switch (prop) {
          case 'append': {
            return (name: string, value: string): void => {
              validateHeaderName(name);
              validateHeaderValue(name, String(value));
              (
                URLSearchParams.prototype.append as (
                  this: URLSearchParams,
                  name: string,
                  value: string,
                ) => void
              ).call(target, name.toLowerCase(), String(value));
            };
          }
          case 'set': {
            return (name: string, value: string): void => {
              validateHeaderName(name);
              validateHeaderValue(name, String(value));
              (
                URLSearchParams.prototype.set as (
                  this: URLSearchParams,
                  name: string,
                  value: string,
                ) => void
              ).call(target, name.toLowerCase(), String(value));
            };
          }
          case 'delete': {
            return (name: string): void => {
              validateHeaderName(name);
              (
                URLSearchParams.prototype.delete as (
                  this: URLSearchParams,
                  name: string,
                ) => void
              ).call(target, name.toLowerCase());
            };
          }
          case 'has': {
            return (name: string): boolean => {
              validateHeaderName(name);
              return (
                URLSearchParams.prototype.has as (
                  this: URLSearchParams,
                  name: string,
                ) => boolean
              ).call(target, name.toLowerCase());
            };
          }
          case 'getAll': {
            return (name: string): string[] => {
              validateHeaderName(name);
              return (
                URLSearchParams.prototype.getAll as (
                  this: URLSearchParams,
                  name: string,
                ) => string[]
              ).call(target, name.toLowerCase());
            };
          }
          case 'keys': {
            return () => {
              target.sort();
              return new Set(
                (
                  URLSearchParams.prototype.keys as (
                    this: URLSearchParams,
                  ) => IterableIterator<string>
                ).call(target),
              ).values();
            };
          }
          default: {
            return Reflect.get(target, prop, receiver);
          }
        }
      },
    }) as Headers;
  }

  get [Symbol.toStringTag](): string {
    return this.constructor.name;
  }

  toString(): string {
    return Object.prototype.toString.call(this);
  }

  /**
   * Returns the header value for a given name.
   * If multiple values exist, they are joined with a comma.
   * For 'content-encoding', the result is lowercased.
   */
  get(name: string): string | null {
    const values = this.getAll(name);
    if (values.length === 0) {
      return null;
    }
    let value = values.join(', ');
    if (/^content-encoding$/i.test(name)) {
      value = value.toLowerCase();
    }
    return value;
  }

  forEach(
    callback: (value: string, key: string, parent: URLSearchParams) => void,
    thisArg?: any,
  ): void {
    for (const name of this.keys()) {
      Reflect.apply(callback, thisArg, [this.get(name)!, name, this]);
    }
  }

  // Override values(), entries(), and [Symbol.iterator] so that their return
  // types (which include extra iterator helpers in Node) are satisfied.
  override values(): ReturnType<URLSearchParams['values']> {
    const self = this;
    function* generator() {
      for (const name of self.keys()) {
        yield self.get(name)!;
      }
    }
    return generator() as unknown as ReturnType<URLSearchParams['values']>;
  }

  override entries(): ReturnType<URLSearchParams['entries']> {
    const self = this;
    function* generator() {
      for (const name of self.keys()) {
        yield [name, self.get(name)!] as [string, string];
      }
    }
    return generator() as unknown as ReturnType<URLSearchParams['entries']>;
  }

  override [Symbol.iterator](): ReturnType<URLSearchParams['entries']> {
    return this.entries();
  }

  /**
   * Returns all headers as an object mapping each header name to an array of values.
   */
  raw(): Record<string, string[]> {
    return [...this.keys()].reduce(
      (result, key) => {
        result[key] = this.getAll(key);
        return result;
      },
      {} as Record<string, string[]>,
    );
  }

  /**
   * Custom inspect method for Node.js.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): Record<
    string,
    string | string[]
  > {
    return [...this.keys()].reduce(
      (result, key) => {
        const values = this.getAll(key);
        // For 'host', only the first value is used.
        if (key === 'host') {
          result[key] = values[0];
        } else {
          result[key] = values.length > 1 ? values : values[0];
        }
        return result;
      },
      {} as Record<string, string | string[]>,
    );
  }
}

/**
 * Make some methods enumerable for better inspection and Web IDL tests.
 */
Object.defineProperties(
  Headers.prototype,
  ['get', 'entries', 'forEach', 'values'].reduce(
    (result, property) => {
      result[property] = { enumerable: true };
      return result;
    },
    {} as Record<string, PropertyDescriptor>,
  ),
);

/**
 * Utility: Create a Headers instance from raw header arrays (e.g. from
 * http.IncomingMessage.rawHeaders).
 */
export function fromRawHeaders(headers: string[] = []): Headers {
  const pairs = headers
    .reduce((result: string[][], _value, index, array) => {
      if (index % 2 === 0) {
        result.push(array.slice(index, index + 2));
      }
      return result;
    }, [])
    .filter(([name, value]) => {
      try {
        validateHeaderName(name);
        validateHeaderValue(name, String(value));
        return true;
      } catch {
        return false;
      }
    });
  return new Headers(pairs);
}
