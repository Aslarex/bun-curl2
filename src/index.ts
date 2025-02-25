import Http from './services/http';
import type {
  CacheType,
  Initialize,
  RedisServer,
  RequestInit,
} from './@types/Options';

class BunCurl {
  private cache?: {
    server: RedisServer;
    defaultExpiration?: number;
  };

  constructor(private args: Initialize & { cache?: CacheType } = {}) {}

  async initializeCache(): Promise<boolean> {
    if (!this.args.cache) return new Promise<boolean>(resolve => resolve(false));
    try {
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
      if (!this.cache.server.isOpen) {
        await this.cache.server.connect();
      }
      return true;
    } catch (e) {
      const cacheInitializationError = new Error("Initializing cache has failed, perhaps redis is not installed?");
      Object.defineProperties(cacheInitializationError, {
        code: {
          value: "ERR_CACHE_INITIALIZATION",
        },
        cause: {
          value: e
        }
      });
      throw cacheInitializationError;
    }
  }

  async disconnectCache(): Promise<void> {
    return this.cache?.server.disconnect();
  }

  private async request<T = any>(
    url: string,
    method: RequestInit['method'],
    options: RequestInit<T> = {}
  ) {
    return Http<T>(
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
    return this.request<T>(url, 'GET', options as RequestInit<T>);
  }

  async post<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'POST', options as RequestInit<T>);
  }

  async delete<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'DELETE', options as RequestInit<T>);
  }

  async put<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'PUT', options as RequestInit<T>);
  }

  async patch<T = any>(url: string, options?: Omit<RequestInit<T>, 'method'>) {
    return this.request<T>(url, 'PATCH', options as RequestInit<T>);
  }

  async head<T = any>(
    url: string,
    options?: Omit<RequestInit<T>, 'method' | 'body'>
  ) {
    return this.request<T>(url, 'HEAD', options as RequestInit<T>);
  }
}

export default BunCurl;

export { Http, Http as HTTP, Http as fetch };