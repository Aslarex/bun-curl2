import type { RedisClientOptions } from 'redis';
import CustomHeaders from '../models/headers';

interface RedisServer {
  connect: () => Promise<RedisServer>,
  get: (key: string) => Promise<string | null>,
  set: (key: string, value: string, options: { EX?: number }) => Promise<string | null>
}

interface BaseCache {
  defaultExpiration?: number;
}

type CacheType =
  | (BaseCache & { server: RedisServer; options?: never })
  | (BaseCache & { options: RedisClientOptions; server?: never })
  | (BaseCache & { server?: never; options?: never });

type Initialize = {
  /**
   * Transform the options before using them
   * @param args
   * @returns RequestInit
   */

  transfomRequest?: (args: RequestInit) => RequestInit;

  /**
   * Enable response compression.
   */

  compress?: boolean;

  /**
   * Set the following user agent as default if its not provided in request headers
   */

  defaultAgent?: string;

  /**
   * Max body size in MB.
   */

  maxBodySize?: number;
};

interface Connection {
  proxy?: string;
  tls?: {
    ciphers?: {
      TLS12?: string[] | string;
      TLS13?: string[] | string;
    };
    versions?: (1.3 | 1.2)[];
  };
  http?: {
    version?: 3.0 | 2.0 | 1.1;
    keepAlive?: number;
    keepAliveProbes?: number;
  };
  connectionTimeout?: number;
  maxTime?: number;
}

interface ExtraOptions<T> {
  /**
   * Transform the options before using them
   * @param args
   * @returns RequestInit
   * @overrides Initialized.transformRequest
   */
  transformRequest?: (args: RequestInit<T>) => RequestInit<T>;
  /**
   * Transform the response before returning it.
   * @param args
   * @returns Response<T>
   */
  transformResponse?: (args: Response<T>) => Response<T>;
  /**
   * Try to automatically parse response body to JSON
   * @default true
   */
  parseResponse?: boolean;

  /**
   * Use caching for the following request?
   * **OR**
   * modify caching options for the following request.
   */
  cache?:
    | boolean
    | {
        expire?: number;
        keys?: (keyof RequestInit)[];
      };
}

interface BaseRequestInit<T> {
  body?: string | Record<string, any>;
  headers?: Record<string, string | number> | Headers;
  method?: string;
  follow?: boolean | number;
}

interface RequestInit<T = any>
  extends BaseRequestInit<T>,
    ExtraOptions<T>,
    Connection {}

interface Response<T = any> {
  response: T;
  options: RequestInit<T>;
  text(): string;
  arrayBuffer(): ArrayBuffer;
  blob(): Blob;
  json(): any;
  headers: CustomHeaders;
  status: number;
  ok: boolean;
  redirected: boolean;
  type: string;
  url: string;
  cached: boolean;
  body: string;
  elapsedTime: number;
}

type RawResponse = {
  url: string;
  body: string;
  headers: string[][] | [string, string][];
  status: number;
  ok: boolean;
  startTime: number;
  cached: boolean;
  parseResponse: boolean;
};

export type { RequestInit, Response, CacheType, Initialize, RawResponse, RedisServer };
