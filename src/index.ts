import Http from "./services/http";
import type { CacheType, Initialize, RequestInit } from "./types/Options";
import { type RedisClientType } from "redis";

class BunCurl {
  private cache?: {
    server: RedisClientType;
    defaultExpiration?: number;
  };

  constructor(private args: Initialize & { cache?: CacheType } = {}) {}

  async initializeCache() {
    if (!this.args.cache) return new Promise<void>((resolve) => resolve());
    try {
      if (this.args.cache.server) {
        this.cache = {
          server: this.args.cache.server,
          defaultExpiration: this.args.cache.defaultExpiration
        };
      } else {
        const redis = await import("redis");
        this.cache = {
          server: redis.createClient(this.args.cache.options) as RedisClientType,
          defaultExpiration: this.args.cache.defaultExpiration,
        };
      }
    } catch (e: any) {
      throw new Error("Initializing cache has failed, perhaps redis is not installed?" + e);
    }
  }

  private async request<T = any>(
    url: string,
    method: RequestInit["method"],
    options: RequestInit<T> = {}
  ) {
    return Http(
      url,
      { ...options, method },
      { ...this.args, cache: this.cache }
    );
  }

  async fetch<T = any>(url: string, options?: RequestInit<T>) {
    return this.request(url, options?.method || "GET", options);
  }

  async get<T = any>(url: string, options?: Omit<RequestInit<T>, "method" | "body"> ) {
    return this.request(url, "GET", options as RequestInit<T>);
  }

  async post<T = any>(url: string, options?: Omit<RequestInit<T>, "method">) {
    return this.request(url, "POST", options as RequestInit<T>);
  }

  async delete<T = any>(url: string, options?: Omit<RequestInit<T>, "method">) {
    return this.request(url, "DELETE", options as RequestInit<T>);
  }

  async put<T = any>(url: string, options?: Omit<RequestInit<T>, "method">) {
    return this.request(url, "PUT", options as RequestInit<T>);
  }

  async patch<T = any>(url: string, options?: Omit<RequestInit<T>, "method">) {
    return this.request(url, "PATCH", options as RequestInit<T>);
  }

  async head<T = any>(url: string, options?: Omit<RequestInit<T>, "method" | "body">) {
    return this.request(url, "HEAD", options as RequestInit<T>);
  }
}

export { Http };

export default BunCurl;