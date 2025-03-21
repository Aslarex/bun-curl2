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
  UsableCache,
} from './types';
import Headers from './models/headers';
import { LocalCache } from './services/cacheStore';
import { ResponseWrapper } from './services/response';
import { DNS_CACHE_MAP, TLS } from './models/constants';

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
 * const bunCurl = new BunCurl2({ cache: { mode: 'redis', options: { host: 'localhost' } } });
 * await bunCurl.initializeCache();
 * const response = await bunCurl.get('https://example.com');
 */
export class BunCurl2 {
  /**
   * The cache instance that can be either a Redis server or a local cache.
   *
   * @private
   */
  private cache?: UsableCache;

  /**
   * Creates an instance of BunCurl2.
   *
   * @param args - Global initialization options merged with cache settings.
   */
  constructor(private args: GlobalInit & { cache?: CacheType } = {}) {}

  /**
   * *NOTE: this will be renamed to `BunCurl2.init` for future planned updates, its better to start using `BunCurl2.init` as of now.*
   *
   * @description
   * Initializes the cache based on the provided configuration.
   *
   * If no cache configuration is provided, returns false.
   * Supports 'local' and 'redis' modes.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the cache was successfully initialized; false otherwise.
   * @throws {Error} Throws an error with code 'ERR_CACHE_INITIALIZATION' if cache initialization fails.
   */
  async initializeCache(): Promise<boolean> {
    if (!this.args.cache) return false;
    this.args.cache.mode = this.args.cache.mode ?? 'redis';
    try {
      switch (this.args.cache.mode) {
        case 'local':
          this.cache = {
            server: new LocalCache<string>(),
            defaultExpiration: this.args.cache.defaultExpiration,
          };
          break;
        case 'redis':
          if (this.args.cache.server) {
            this.cache = {
              server: this.args.cache.server,
              defaultExpiration: this.args.cache.defaultExpiration,
            };
          } else {
            const redis = await import('redis');
            this.cache = {
              server: redis.createClient(this.args.cache.options),
              defaultExpiration: this.args.cache.defaultExpiration,
            };
          }
          const server = this.cache.server as RedisServer;
          if (!server.isOpen) {
            await server.connect();
          }
          break;
        default:
          console.error(
            `[BunCurl2] - Received invalid cache mode (${this.args.cache.mode})`,
          );
          return false;
      }
      return true;
    } catch (e) {
      const cacheInitializationError = new Error(
        '[BunCurl2] - Initializing cache has failed',
      );
      Object.defineProperties(cacheInitializationError, {
        code: {
          value: 'ERR_CACHE_INITIALIZATION',
        },
        cause: {
          value: e,
        },
      });
      throw cacheInitializationError;
    }
  }

  /**
   * @alias initializeCache
   */
  init = this.initializeCache;

  /**
   * @alias initializeCache
   */
  connect = this.initializeCache;

  /**
   * NOTE: this will be renamed to `BunCurl2.destroy` for future planned updates, its better to start using `BunCurl2.destroy` as of now.
   *
   * @description
   * Disconnects the cache server.
   *
   * If the cache is a local cache, it calls its `end` method.
   * If it's a Redis server, it calls its `disconnect` method.
   *
   * @returns {Promise<void>} A promise that resolves when the cache is disconnected.
   */
  async disconnectCache(): Promise<void> {
    DNS_CACHE_MAP.stopCleanup(), DNS_CACHE_MAP.clear();
    const server = this.cache?.server;
    if (!server) return void 0;
    return server instanceof LocalCache
      ? (server.end(), void 0)
      : server?.disconnect();
  }

  /**
   * @alias disconnectCache
   */
  destroy = this.disconnectCache;

  /**
   * @alias disconnectCache
   */
  disconnect = this.disconnectCache;

  /**
   * Internal method to perform an HTTP request.
   *
   * @private
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param method - The HTTP method to use.
   * @param options - Additional request options.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  private async request<T = any>(
    url: string,
    method: RequestInit['method'],
    options: RequestInit<T> = {},
  ): Promise<ResponseInit<T>> {
    return HTTPRequest<T>(
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
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async fetch<T = any>(
    url: string,
    options?: RequestInit<T>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, options?.method || 'GET', options);
  }

  /**
   * Performs an HTTP GET request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method and body.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async get<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method' | 'body'>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, 'GET', options);
  }

  /**
   * Performs an HTTP POST request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async post<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method'>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, 'POST', options);
  }

  /**
   * Performs an HTTP DELETE request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async delete<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method'>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, 'DELETE', options);
  }

  /**
   * Performs an HTTP PUT request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async put<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method'>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, 'PUT', options);
  }

  /**
   * Performs an HTTP PATCH request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async patch<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method'>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, 'PATCH', options);
  }

  /**
   * Performs an HTTP HEAD request.
   *
   * @template T - The expected type of the response body.
   * @param url - The URL to request.
   * @param options - Request options excluding method and body.
   * @returns {Promise<ResponseInit<T>>} A promise that resolves to the response.
   */
  async head<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method' | 'body'>,
  ): Promise<ResponseInit<T>> {
    return this.request<T>(url, 'HEAD', options);
  }
}

export default BunCurl2;
