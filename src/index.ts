if (!globalThis.Bun) {
  throw new Error('Bun (https://bun.sh) is required to run this package');
}
if (!('BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS' in process.env)) {
  process.env.BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS = '0';
}
import HTTPRequest from './services/http';
import type {
  RequestInit,
  RequestInitWithURL,
  ResponseInit,
  CacheType,
  GlobalInit,
  BaseResponseInit,
  RedisServer,
  BaseRequestInit,
  BaseCache,
  CacheKeys,
  CacheInstance,
} from './types';
import Headers from './models/headers';
import { LocalCache } from './services/cache';
import { ResponseWrapper } from './services/response';
import { DNS_CACHE_MAP, TLS } from './models/constants';
import { compareVersions } from './models/utils';
import { RedisOptions } from 'bun';

export type {
  RequestInit,
  RequestInitWithURL,
  BaseResponseInit,
  CacheType,
  GlobalInit,
  ResponseInit,
  RedisServer,
  BaseRequestInit,
  BaseCache,
  CacheKeys,
};

export {
  HTTPRequest as Http,
  HTTPRequest as HTTP,
  HTTPRequest as fetch,
  HTTPRequest,
  Headers,
  ResponseWrapper,
  TLS,
};

/**
 * BunCurl2 provides a high-level HTTP client with caching support.
 *
 * @example
 * const bunCurl = new BunCurl2({ cache: { mode: 'local' } });
 * await bunCurl.initializeCache();
 * const response = await bunCurl.get('https://example.com');
 */
export class BunCurl2<U extends boolean = false> {
  /**
   * The cache instance that can be either a Redis server or a local cache.
   *
   * @private
   */
  private cache?: CacheInstance;

  /**
   * Creates an instance of BunCurl2.
   *
   * @param args - Global initialization options merged with cache settings.
   */
  constructor(
    private args: GlobalInit & { redirectsAsUrls?: U; cache?: CacheType } = {},
  ) {}

  /**
   * @description
   * Prepare the cache server
   */
  async connect() {
    const { cache } = this.args;
    if (!cache) return false;
    cache.mode = cache.mode ?? 'redis';
    this.cache = {
      defaultExpiration: cache.defaultExpiration,
      server: null!,
    };
    try {
      switch (cache.mode) {
        case 'local':
        case 'client':
          this.cache.server = new LocalCache<string>();
          break;
        case 'redis':
          if (cache.server) {
            this.cache.server = cache.server;
          } else {
            const isBunClientSupported =
              compareVersions(Bun.version, '1.2.9') >= 0;
            if (cache.useRedisPackage || !isBunClientSupported) {
              if (!isBunClientSupported)
                console.warn(
                  '⚠️ [BunCurl2] - Detected Bun version does not supported redis client API implemented by them, fallbacking to redis package',
                );
              const { createClient } = await import('redis');
              this.cache.server = createClient(
                cache.useRedisPackage
                  ? cache.options
                  : { url: cache.options?.url },
              );
            } else {
              const { RedisClient } = await import('bun');
              this.cache.server = new RedisClient(
                cache.options?.url,
                Object.assign(cache.options ?? {}, {
                  url: undefined,
                }) as RedisOptions,
              );
            }
          }
          const server = this.cache.server;
          if ('isOpen' in server && !server.isOpen) {
            await server.connect();
          } else if ('connected' in server && !server.connected) {
            await server.connect();
          }
          break;
        default:
          console.error(
            `[BunCurl2] - Received invalid cache mode (${cache.mode})`,
          );
          return false;
      }
      return true;
    } catch (e) {
      const cacheInitializationError = new Error(
        '[BunCurl2] - Client initialization has failed',
      );
      Object.defineProperties(cacheInitializationError, {
        code: {
          value: 'ERR_CLIENT_INITIALIZATION',
        },
        cause: {
          value: e,
        },
      });
      throw cacheInitializationError;
    }
  }

  /**
   * @alias connect
   */
  init = this.connect;

  /**
   * @description
   * Destroys the `BunCurl2` client.
   */
  async destroy() {
    DNS_CACHE_MAP.end();
    if (!this.cache?.server) return;
    const server = this.cache.server;
    if (server instanceof LocalCache) {
      server.end();
    } else {
      'disconnect' in server ? await server.disconnect() : server.close();
    }
  }

  /**
   * @alias destroy
   */
  disconnect = this.destroy;

  /**
   * Internal method to perform an HTTP request.
   *
   * @private
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param method - The HTTP method to use.
   * @param options - Additional request options.
   */
  private async request<T = any>(
    url: string,
    method: RequestInit['method'],
    options: RequestInit<T, U> = {},
  ) {
    return HTTPRequest<T, U>(
      url,
      { ...options, method },
      { ...this.args, cache: this.cache },
    );
  }

  /**
   * Performs an HTTP fetch request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to fetch.
   * @param options - Optional request options.
   */
  async fetch<T = any>(url: string, options?: RequestInit<T, U>) {
    return this.request<T>(url, options?.method || 'GET', options);
  }

  /**
   * Performs an HTTP GET request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method and body.
   */
  async get<T = any>(
    url: string,
    options?: Omit<RequestInit<T, U>, 'method' | 'body'>,
  ) {
    return this.request<T>(url, 'GET', options);
  }

  /**
   * Performs an HTTP POST request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   */
  async post<T = any>(
    url: string,
    options?: Omit<RequestInit<T, U>, 'method'>,
  ) {
    return this.request<T>(url, 'POST', options);
  }

  /**
   * Performs an HTTP DELETE request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   */
  async delete<T = any>(
    url: string,
    options?: Omit<RequestInit<T, U>, 'method'>,
  ) {
    return this.request<T>(url, 'DELETE', options);
  }

  /**
   * Performs an HTTP PUT request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   */
  async put<T = any>(url: string, options?: Omit<RequestInit<T, U>, 'method'>) {
    return this.request<T>(url, 'PUT', options);
  }

  /**
   * Performs an HTTP PATCH request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   */
  async patch<T = any>(
    url: string,
    options?: Omit<RequestInit<T, U>, 'method'>,
  ) {
    return this.request<T>(url, 'PATCH', options);
  }

  /**
   * Performs an HTTP HEAD request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method and body.
   */
  async head<T = any>(
    url: string,
    options?: Omit<RequestInit<T, U>, 'method' | 'body'>,
  ) {
    return this.request<T>(url, 'HEAD', options);
  }
}

export default BunCurl2;
