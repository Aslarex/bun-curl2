import type {
  CacheKeys,
  GlobalInit,
  RequestInit,
  ResponseInit,
  CacheInstance,
} from '../types';
import BuildCommand from './command';
import { processAndBuild, ResponseWrapper } from './response';
import TTLCache from './cache';
import Headers from '../models/headers';
import { RedisClient } from 'bun';
import { md5 } from '../models/utils';

let concurrentRequests = 0;

const concurrentError = <T, U extends boolean>(
  max: number,
  options: RequestInit<T, U>,
  url: string,
) =>
  Object.assign(
    new Error(`[BunCurl2] - Maximum concurrent requests (${max}) reached`),
    { code: 'ERR_CONCURRENT_REQUESTS_REACHED', options: { ...options, url } },
  );

async function parseReader(
  stream: ReadableStream<Uint8Array>,
  originalUrl: string,
): Promise<{
  status: number;
  headers: [string, string][];
  reader: ReadableStreamDefaultReader<Uint8Array>;
  leftover: Uint8Array;
  redirects: string[];
}> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let buffer = new Uint8Array(0);
  const redirects: string[] = [];
  let currentUrl = originalUrl;

  function indexOfDoubleCRLF(arr: Uint8Array): number {
    for (let i = 0; i < arr.length - 3; i++) {
      if (
        arr[i] === 13 &&
        arr[i + 1] === 10 &&
        arr[i + 2] === 13 &&
        arr[i + 3] === 10
      ) {
        return i;
      }
    }
    return -1;
  }

  while (true) {
    while (true) {
      const idx = indexOfDoubleCRLF(buffer);
      if (idx !== -1) break;

      const { done, value } = await reader.read();
      if (done) throw new Error('Stream ended before headers finished');

      const newBuffer = new Uint8Array(buffer.length + value.length);
      newBuffer.set(buffer, 0);
      newBuffer.set(value, buffer.length);
      buffer = newBuffer;
    }

    const headerEndIndex = indexOfDoubleCRLF(buffer);
    const headerBytes = buffer.subarray(0, headerEndIndex);
    const leftover = buffer.subarray(headerEndIndex + 4);

    const headerText = decoder.decode(headerBytes, { stream: true });
    const lines = headerText.split('\r\n');
    const statusLine = lines.shift()!;
    const status = parseInt(statusLine.split(' ')[1], 10) || 0;

    const headers: [string, string][] = [];
    let locationHeader: string | null = null;

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        headers.push([key, value]);
        if (key.toLowerCase() === 'location') {
          locationHeader = value;
        }
      }
    }

    if (status >= 300 && status < 400 && locationHeader) {
      try {
        currentUrl = new URL(locationHeader, currentUrl).toString();
      } catch {
        currentUrl = locationHeader;
      }
      redirects.push(currentUrl);
      buffer = leftover;
      continue;
    }

    return { status, headers, reader, leftover, redirects };
  }
}

export default async function Http<T = any, U extends boolean = false>(
  url: string,
  options: RequestInit<T, U> & { stream: true },
  init?: GlobalInit & { redirectsAsUrls?: U; cache?: CacheInstance },
): Promise<ResponseInit<ReadableStream<Uint8Array>, true>>;

export default async function Http<T = any, U extends boolean = false>(
  url: string,
  options?: RequestInit<T, U> & { stream?: false | undefined },
  init?: GlobalInit & { redirectsAsUrls?: U; cache?: CacheInstance },
): Promise<ResponseInit<T, U>>;

export default async function Http<T = any, U extends boolean = false>(
  url: string,
  options: RequestInit<T, U> & { stream?: boolean } = {},
  init: GlobalInit & { redirectsAsUrls?: U; cache?: CacheInstance } = {},
): Promise<ResponseInit<any, U>> {
  prepareOptions(options, init);

  const uriObj = new URL(url);

  const maxConcurrent = init.maxConcurrentRequests ?? 250;
  if (concurrentRequests >= maxConcurrent)
    throw concurrentError(maxConcurrent, options, url);

  let cacheKey: string | undefined;
  const cacheServer = init.cache?.server;

  if (options.cache && cacheServer && !options.stream) {
    cacheKey = await getCacheKey(url, options);
    const cached = await cacheServer.get(cacheKey);
    if (cached != null) {
      try {
        const ts = performance.now();
        const resp = processAndBuild(
          url,
          cached,
          ts,
          options.parseJSON ?? true,
          true,
          options,
          init,
        );
        return options.transformResponse
          ? options.transformResponse(resp)
          : resp;
      } catch {
        console.warn(
          `[BunCurl2] - Corrupted cache entry, skipping [${cacheKey}]`,
        );
      }
    }
  }

  concurrentRequests++;
  let proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>;
  try {
    const tsStart = performance.now();
    const build = await BuildCommand<T, U>(uriObj, options, init);
    proc = Bun.spawn(build.cmd, { stdout: 'pipe', stderr: 'pipe' });
    url = build.url.toString();

    if (options.stream) {
      if (!proc.stdout) throw new Error('[BunCurl2] - Missing stdout');

      let { status, headers, reader, leftover, redirects } = await parseReader(
        proc.stdout,
        url,
      );

      const bodyStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (leftover.length > 0) {
            controller.enqueue(leftover);
            leftover = new Uint8Array(0);
            return;
          }
          return reader.read().then(({ done, value }) => {
            if (done) controller.close();
            else if (value) controller.enqueue(value);
          });
        },
        cancel() {
          reader.cancel();
        },
      });

      const ok = status >= 200 && status < 300;
      const redirected = redirects.length > 0;
      const type = status >= 400 ? 'error' : 'default';

      return new ResponseWrapper<ReadableStream<Uint8Array>, U>(
        url,
        bodyStream,
        new Headers(headers),
        status,
        ok,
        redirected,
        type,
        false,
        performance.now() - tsStart,
        options as RequestInit<ReadableStream<Uint8Array>, U>,
        redirects as any,
      ) as ResponseInit<ReadableStream<Uint8Array>, U>;
    } else {
      const stdoutPromise = (async () => {
        if (!proc.stdout) throw new Error('[BunCurl2] - Missing stdout');
        const buf = await new Response(proc.stdout).arrayBuffer();
        return Buffer.from(buf).toString('binary');
      })();

      const abortPromise = new Promise<never>((_, reject) => {
        if (options.signal) {
          if (options.signal.aborted) {
            proc.kill();
            reject(
              new DOMException('The operation was aborted.', 'AbortError'),
            );
          } else {
            options.signal.addEventListener(
              'abort',
              () => {
                proc.kill();
                reject(
                  new DOMException('The operation was aborted.', 'AbortError'),
                );
              },
              { once: true },
            );
          }
        }
      });

      let stdout: string;
      try {
        stdout = await Promise.race([stdoutPromise, abortPromise]);
      } catch (err) {
        await proc.exited;
        throw err;
      }

      await proc.exited;

      if (proc.exitCode !== 0) {
        const stderrData = await (async () => {
          if (!proc.stderr) throw new Error('[BunCurl2] - Missing stderr');
          const buf = await new Response(proc.stderr).arrayBuffer();
          return Buffer.from(buf).toString('utf-8');
        })();

        const msg = stderrData.trim().replace(/curl:\s*\(\d+\)\s*/, '');
        throw Object.assign(new Error(`[BunCurl2] - ${msg}`), {
          code: 'ERR_CURL_FAILED',
          exitCode: proc.exitCode,
          options: { ...options, url },
        });
      }

      const resp = processAndBuild<T, U>(
        url,
        stdout,
        tsStart,
        options.parseJSON ?? true,
        false,
        options,
        init,
      );

      if (cacheKey && cacheServer && typeof options.cache === 'object') {
        if (
          typeof options.cache.validate === 'function' &&
          !(await options.cache.validate(resp))
        ) {
          return options.transformResponse
            ? options.transformResponse(resp)
            : resp;
        }

        const expireMs =
          (typeof options.cache.expire === 'number'
            ? options.cache.expire
            : init.cache!.defaultExpiration!) * 1e3;

        if (cacheServer instanceof TTLCache) {
          cacheServer.set(cacheKey, stdout, expireMs);
        } else if (cacheServer instanceof RedisClient) {
          await cacheServer.send('SET', [
            cacheKey,
            stdout,
            'PX',
            String(expireMs - 1),
            'NX',
          ]);
        } else {
          await cacheServer.set(cacheKey, stdout, {
            expiration: { type: 'PX', value: expireMs },
            condition: 'NX',
          });
        }
      }

      return options.transformResponse ? options.transformResponse(resp) : resp;
    }
  } finally {
    concurrentRequests--;
  }
}

async function getCacheKey<T, U extends boolean>(
  url: string,
  options: RequestInit<T, U>,
): Promise<string> {
  if (typeof options.cache === 'object' && options.cache.generate)
    return options.cache.generate({ url, ...options });
  return generateCacheKey(url, options);
}

function prepareOptions<T, U extends boolean>(
  options: RequestInit<T, U>,
  init: GlobalInit & { cache?: CacheInstance },
) {
  options.dns = options.dns ?? {
    cache: true,
    servers: ['1.1.1.1', '1.0.0.1'],
  };
  options.parseJSON = options.parseJSON ?? init.parseJSON ?? true;
  options.method = options.method ?? 'GET';
  options.compress = options.compress ?? init.compress ?? true;
  options.follow = options.follow ?? true;
  options.sortHeaders = options.sortHeaders ?? true;
  options.http = options.http ?? {
    keepAlive: true,
    keepAliveProbes: 3,
  };
  init.tcp = init.tcp ?? {
    fastOpen: true,
    noDelay: true,
  };
  if (init.cache)
    init.cache.defaultExpiration = init.cache.defaultExpiration ?? 5;
}

function generateCacheKey<T, U extends boolean>(
  url: string,
  options: RequestInit<T, U>,
): string {
  const fields: CacheKeys[] = ['url', 'headers', 'body', 'proxy', 'method'];
  const keys =
    !options.cache ||
    typeof options.cache === 'boolean' ||
    !('keys' in options.cache) ||
    !options.cache.keys
      ? fields
      : options.cache.keys;
  const serialized = keys.map((key) => serializeField(key, options, url));
  return md5(`BunCurl2|${serialized.join('|')}`);
}

function serializeField<T, U extends boolean>(
  key: CacheKeys,
  options: RequestInit<T, U>,
  url: string,
): string {
  let val: unknown = key === 'url' ? url : (options as any)[key];
  if (val instanceof Headers) {
    val = Array.from(val.entries()).map(([h, v]) => h + v);
  }
  return typeof val === 'object' && val !== null
    ? JSON.stringify(val)
    : String(val);
}
