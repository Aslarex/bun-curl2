import type { RedisClientOptions } from 'redis';
import CustomHeaders from './models/headers';

/**
 * Represents a connection to a Redis server and provides basic operations.
 */
interface RedisServer {
  /**
   * Establishes a connection to the Redis server.
   *
   * @returns A promise that resolves to the connected RedisServer instance.
   */
  connect: () => Promise<RedisServer>;

  /**
   * Gracefully close a client's connection to Redis. Wait for commands in process, but reject any new commands.
   */
  disconnect: () => Promise<void>;

  /**
   * Retrieves the value associated with the specified key from the Redis server.
   *
   * @param key - The key whose value is to be retrieved.
   * @returns A promise that resolves to the value as a string, or null if the key does not exist.
   */
  get: (key: string) => Promise<string | null>;

  /**
   * Sets a key-value pair in the Redis server with an optional expiration time.
   *
   * @param key - The key to be set.
   * @param value - The value to be stored.
   * @param options - Optional settings; supports EX (expiration in seconds), NX (Only set the key if it does not already exist).
   * @returns A promise that resolves to the stored value as a string, or null.
   */
  set: (
    key: string,
    value: string,
    options: { EX?: number; NX?: true }
  ) => Promise<string | null>;

  /**
   * Determines if the connection is open
   */
  isOpen: boolean;
}

/**
 * Base configuration for caching mechanisms.
 */
interface BaseCache {
  /**
   * The default expiration time for cached entries in seconds.
   * @default 5
   */
  defaultExpiration?: number;
}

/**
 * Defines the different configurations available for caching.
 *
 * It supports one of the following three configurations:
 * - A Redis server based cache.
 * - A cache using Redis client options.
 * - A cache with neither server nor options defined with a mode: "redis".
 * - A default mode cache
 */
type CacheType =
  | (BaseCache & { server: RedisServer; options?: never; mode?: 'redis' })
  | (BaseCache & {
      options: RedisClientOptions;
      server?: never;
      mode?: 'redis';
    })
  | (BaseCache & { server?: never; options?: never; mode?: 'redis' })
  | (BaseCache & { mode?: 'local' });

/**
 * Initialization options for configuring requests.
 */
type GlobalInit = {
  /**
   * Transforms the outgoing request options before the request is sent.
   *
   * @param args - The initial RequestInit object.
   * @returns A transformed RequestInit object.
   */
  transfomRequest?: (args: RequestInit & { url: string }) => RequestInit;

  /**
   * Enables response compression if set to true.
   * @default true
   */
  compress?: boolean;

  /**
   * Specifies the default user agent to use if one is not provided in the request headers.
   */
  defaultAgent?: string;

  /**
   * Maximum allowed size of the request body in megabytes.
   */
  maxBodySize?: number;

  /**
   * Flag indicating if we should try parsing response to **JSON** automatically.
   *
   * @default true
   */
  parseJSON?: boolean;

  /**
   * TCP Configuration Options
   */
  tcp?: {
    /**
     * @description
     * sets a --tcp-fastopen flag
     * @default true
     * @requires cURL >= 7.49.0
     */
    fastOpen?: boolean;
    /**
     * @description
     * sets a --tcp-nodelay flag
     * @default true
     * @requires cURL >= 7.11.2
     */
    noDelay?: boolean;
  };
};

/**
 * Represents the connection settings for HTTP/TLS and proxy configurations.
 */
interface Connection {
  /**
   * Proxy server URL to route the request through.
   */
  proxy?: string;

  /**
   * TLS-specific configurations.
   */
  tls?: {
    /**
     * Supported cipher suites for TLS 1.2 and TLS 1.3.
     */
    ciphers?: {
      TLS12?: string[] | string;
      TLS13?: string[] | string;
    };
    /**
     * Supported TLS versions.
     */
    versions?: (1.3 | 1.2)[];

    /**
     * Disable certificate checks for HTTPS targets
     * @default false
     */
    insecure?: boolean;
  };

  /**
   * HTTP-specific connection settings.
   */
  http?: {
    /**
     * HTTP protocol version.
     */
    version: 3.0 | 2.0 | 1.1;
    /**
     * The keep-alive setting for the connection (HTTP/1.1).
     *
     * When set to a number, it represents the time in seconds to keep the connection alive.
     * When set to a boolean, it indicates whether to enable (true) or disable (false) the keep-alive feature.
     */
    keepAlive?: number | boolean;
    /**
     * Number of probes to check if the connection is still alive.
     */
    keepAliveProbes?: number;
  };

  /**
   * Connection timeout duration in milliseconds.
   */
  connectionTimeout?: number;

  /**
   * Maximum time in milliseconds allowed for the entire request/response cycle.
   */
  maxTime?: number;
}

export type CacheKeys = 'url' | 'body' | 'headers' | 'proxy' | 'method';

/**
 * Extra options to enhance request and response handling.
 *
 * @template T - The type of data expected in the request or response.
 */
interface ExtraOptions<T> {
  /**
   * Function to transform the request options before the request is made.
   *
   * @param args - The initial RequestInit object.
   * @returns A transformed RequestInit object.
   * @override GlobalInit.transformRequest
   */
  transformRequest?:
    | ((args: RequestInit<T> & { url: string }) => RequestInit<T>)
    | false;

  /**
   * Function to transform the response before it is returned to the caller.
   *
   * @param args - The original Response object.
   * @returns A transformed Response object.
   */
  transformResponse?: (
    args: ResponseInit<T>
  ) => ResponseInit<T> | Promise<ResponseInit<T>>;

  /**
   * Flag indicating if we should try parsing response to **JSON** automatically.
   *
   * @default true
   */
  parseJSON?: boolean;

  /**
   * Configures caching for the request.
   */
  cache?:
    | boolean
    | {
        /**
         * The expiration time for the cache entry in seconds.
         */
        expire?: number;
        /**
         * An array of keys (from RequestInit) to be considered for caching. (default: **all**)
         */
        keys?: CacheKeys[];
        /**
         * Function to validate if request is eligible for caching.
         */
        validate?: (response: ResponseInit<T>) => boolean | Promise<boolean>;
        /**
         * Function for manually generating the cache identifier (key)
         * @override `cache.keys`
         */
        generate?: (
          request: RequestInit<T> & { url: string }
        ) => string | Promise<string>;
      };
  /**
   * Enables response compression if set to true.
   * @default true
   * @override GlobalInit.compress
   */
  compress?: boolean;

  /**
   * DNS Configuration options
   */
  dns?: {
    /**
     * @description
     * An array of DNS server IP addresses to use for domain resolution.
     * Each server should be provided as a string (e.g., "8.8.8.8"). If omitted, the **Google**'s DNS servers are used.
     * @requires cURL build with **c-ares**
     */
    servers?: string[];
    /**
     * @description
     * TTL in seconds for DNS should be cached for current hostname.
     * Provide `false` if you want to disable DNS caching for following hostname.
     * @default 300
     */
    cache?: number | false;
    /**
     * @description
     * Directly connect to the target with following IP to bypass DNS lookup
     * @format `ip`
     */
    resolve?: string;
  };
}

type BodyInit =
  | string
  | Record<string, any>
  | Blob
  | BufferSource
  | FormData
  | URLSearchParams
  | ReadableStream;

/**
 * Basic request initialization options.
 */
interface BaseRequestInit {
  /**
   * The request body
   */
  body?: BodyInit;

  /**
   * The request headers.
   */
  headers?: Record<string, string | number> | Headers | CustomHeaders;

  /**
   * The HTTP method to be used for the request (e.g., GET, POST).
   */
  method?: string;

  /**
   * Flag or count indicating if and how redirects should be followed.
   * @default true
   */
  follow?: boolean | number;

  /**
   * An AbortSignal to set request's signal.
   */
  signal?: AbortSignal;
}

/**
 * Comprehensive request initialization type combining base options,
 * extra options for transformation and caching, as well as connection settings.
 *
 * @template T - The type associated with the request body.
 */
interface RequestInit<T = any>
  extends BaseRequestInit,
    ExtraOptions<T>,
    Connection {}

/**
 * Represents an HTTP response with additional metadata.
 *
 * @template T - The type of the response data.
 */
interface ResponseInit<T = any> {
  /**
   * The response payload.
   */
  response: T;

  /**
   * The request options that generated this response.
   */
  options: RequestInit<T>;

  /**
   * Retrieves the response body as plain text.
   *
   * @returns The response body as a string.
   */
  text(): string;

  /**
   * Retrieves the response as an ArrayBuffer.
   *
   * @returns The response body as an ArrayBuffer.
   */
  arrayBuffer(): ArrayBuffer;

  /**
   * Retrieves the response as a Blob.
   *
   * @returns The response body as a Blob.
   */
  blob(): Blob;

  /**
   * Parses and retrieves the response body as JSON.
   *
   * @returns The parsed JSON object.
   */
  json(): any;

  /**
   * The response headers.
   */
  headers: CustomHeaders;

  /**
   * The HTTP status code of the response.
   */
  status: number;

  /**
   * Indicates whether the response status code is in the successful range.
   */
  ok: boolean;

  /**
   * Indicates whether the response was redirected.
   */
  redirected: boolean;

  /**
   * The type of the response.
   */
  type: string;

  /**
   * The URL from which the response was obtained.
   */
  url: string;

  /**
   * Indicates whether the response was served from a cache.
   */
  cached: boolean;

  /**
   * The total time elapsed during the request in milliseconds.
   */
  elapsedTime: number;
}

/**
 * Represents the raw response details from an HTTP request.
 */
type BaseResponseInit = {
  /**
   * The URL from which the response was fetched.
   */
  url: string;

  /**
   * The response body as a string.
   */
  body: string;

  /**
   * The response headers represented as an array of key-value pairs.
   */
  headers: string[][] | [string, string][];

  /**
   * The HTTP status code.
   */
  status: number;

  /**
   * The timestamp marking the start of the request.
   */
  requestStartTime: number;

  /**
   * Indicates whether the response was served from a cache.
   */
  cached: boolean;

  /**
   * Flag indicating if we should try parsing response to **JSON** automatically.
   */
  parseJSON: boolean;
};

export type {
  RequestInit,
  ResponseInit,
  CacheType,
  GlobalInit,
  BaseResponseInit,
  RedisServer,
  BaseRequestInit,
  BaseCache,
};
