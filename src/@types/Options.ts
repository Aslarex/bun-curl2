import type { RedisClientOptions } from 'redis';
import CustomHeaders from '../models/headers';

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
   * @param options - Optional settings; supports EX (expiration in seconds).
   * @returns A promise that resolves to the stored value as a string, or null.
   */
  set: (key: string, value: string, options: { EX?: number }) => Promise<string | null>;
}

/**
 * Base configuration for caching mechanisms.
 */
interface BaseCache {
  /**
   * The default expiration time for cached entries in seconds.
   */
  defaultExpiration?: number;
}

/**
 * Defines the different configurations available for caching.
 *
 * It supports one of the following three configurations:
 * - A Redis server based cache.
 * - A cache using Redis client options.
 * - A cache with neither server nor options defined.
 */
type CacheType =
  | (BaseCache & { server: RedisServer; options?: never })
  | (BaseCache & { options: RedisClientOptions; server?: never })
  | (BaseCache & { server?: never; options?: never });

/**
 * Initialization options for configuring requests.
 */
type Initialize = {
  /**
   * Transforms the outgoing request options before the request is sent.
   *
   * @param args - The initial RequestInit object.
   * @returns A transformed RequestInit object.
   */
  transfomRequest?: (args: RequestInit) => RequestInit;

  /**
   * Enables response compression if set to true.
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
  };

  /**
   * HTTP-specific connection settings.
   */
  http?: {
    /**
     * HTTP protocol version.
     */
    version?: 3.0 | 2.0 | 1.1;
    /**
     * Time (in seconds) to keep the connection alive.
     */
    keepAlive?: number;
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
   * @overrides Initialized.transformRequest
   */
  transformRequest?: (args: RequestInit<T>) => RequestInit<T>;

  /**
   * Function to transform the response before it is returned to the caller.
   *
   * @param args - The original Response object.
   * @returns A transformed Response object.
   */
  transformResponse?: (args: Response<T>) => Response<T>;

  /**
   * Determines whether the response body should be automatically parsed as JSON.
   *
   * @default true
   */
  parseResponse?: boolean;

  /**
   * Configures caching for the request.
   *
   * Can be a simple boolean to enable/disable caching or an object with detailed cache options.
   * - `expire`: The expiration time for the cache in seconds.
   * - `keys`: An array of keys (from RequestInit) to be considered for caching.
   */
  cache?:
    | boolean
    | {
        expire?: number;
        keys?: (keyof RequestInit)[];
      };
}

/**
 * Basic request initialization options.
 *
 * @template T - The type associated with the request body.
 */
interface BaseRequestInit<T> {
  /**
   * The request body, which can be a string or an object.
   */
  body?: string | Record<string, any>;

  /**
   * The request headers.
   */
  headers?: Record<string, string | number> | Headers;

  /**
   * The HTTP method to be used for the request (e.g., GET, POST).
   */
  method?: string;

  /**
   * Flag or count indicating if and how redirects should be followed.
   */
  follow?: boolean | number;
}

/**
 * Comprehensive request initialization type combining base options,
 * extra options for transformation and caching, as well as connection settings.
 *
 * @template T - The type associated with the request body.
 */
interface RequestInit<T = any> extends BaseRequestInit<T>, ExtraOptions<T>, Connection {}

/**
 * Represents an HTTP response with additional metadata.
 *
 * @template T - The type of the response data.
 */
interface Response<T = any> {
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
   * The raw response body as a string.
   */
  body: string;

  /**
   * The total time elapsed during the request in milliseconds.
   */
  elapsedTime: number;
}

/**
 * Represents the raw response details from an HTTP request.
 */
type RawResponse = {
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
   * Indicates whether the response status code signifies a successful request.
   */
  ok: boolean;

  /**
   * The timestamp marking the start of the request.
   */
  startTime: number;

  /**
   * Indicates whether the response was served from a cache.
   */
  cached: boolean;

  /**
   * Flag indicating if the response should be parsed automatically.
   */
  parseResponse: boolean;
};

export type { RequestInit, Response, CacheType, Initialize, RawResponse, RedisServer };