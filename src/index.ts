import HTTPRequest from './services/http';
import type {
  RequestInit,
  ResponseInit,
  CacheType,
  GlobalInit,
  BaseResponseInit,
  RedisServer,
  BaseRequestInit,
  BaseCache,
} from './@types/Options';
import Headers from './models/headers';
import { LocalCache } from './services/local_cache';
import { ResponseWrapper } from './services/response';

export type {
  RequestInit,
  BaseResponseInit,
  CacheType,
  GlobalInit,
  ResponseInit,
  RedisServer,
  BaseRequestInit,
  BaseCache,
};

export {
  HTTPRequest as Http,
  HTTPRequest as HTTP,
  HTTPRequest as fetch,
  HTTPRequest,
  Headers,
  ResponseWrapper,
};

export class BunCurl2 {
  private cache?: {
    server: RedisServer | LocalCache<string>;
    defaultExpiration?: number;
  };

  constructor(private args: GlobalInit & { cache?: CacheType } = {}) {}

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
            `[BunCurl2] - Received invalid cache mode (${this.args.cache.mode})`
          );
          return false;
      }
      return true;
    } catch (e) {
      const cacheInitializationError = new Error(
        '[BunCurl2] - Initializing cache has failed'
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

  async disconnectCache(): Promise<void> {
    const server = this.cache?.server;
    if (!server) return void 0;
    return server instanceof LocalCache
      ? (server.end(), void 0)
      : server?.disconnect();
  }

  private async request<T = any>(
    url: string,
    method: RequestInit['method'],
    options: RequestInit<T> = {}
  ) {
    return HTTPRequest<T>(
      url,
      { ...options, method },
      { ...this.args, cache: this.cache }
    );
  }

  async fetch<T = any>(url: string, options?: RequestInit<T>) {
    return this.request<T>(url, options?.method || 'GET', options);
  }

  async get<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method' | 'body'>
  ) {
    return this.request<T>(url, 'GET', options);
  }

  async post<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'POST', options);
  }

  async delete<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'DELETE', options);
  }

  async put<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'PUT', options);
  }

  async patch<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'PATCH', options);
  }

  async head<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method' | 'body'>
  ) {
    return this.request<T>(url, 'HEAD', options);
  }
}

export default BunCurl2;
