import type {
  CacheKeys,
  GlobalInit,
  RequestInit,
  ResponseInit,
  CacheInstance,
} from '../types';
import BuildCommand from './command';
import { BuildResponse, ProcessResponse } from './response';
import { extractFinalUrl, hasJsonStructure, md5 } from '../models/utils';
import { LocalCache } from './cache';
import { RedisClient } from 'bun';

let concurrentRequests = 0;

const concurrentError = (max: number, options: RequestInit, url: string) =>
  Object.assign(
    new Error(`[BunCurl2] - Maximum concurrent requests (${max}) reached`),
    { code: 'ERR_CONCURRENT_REQUESTS_REACHED', options: { ...options, url } },
  );

export default async function Http<T = any>(
  url: string,
  options: RequestInit<T> = {},
  init: GlobalInit & { cache?: CacheInstance } = {},
): Promise<ResponseInit<T>> {
  prepareOptions(options, init);

  const maxConcurrent = init.maxConcurrentRequests ?? 250;
  if (concurrentRequests >= maxConcurrent)
    throw concurrentError(maxConcurrent, options, url);

  let cacheKey: string | undefined;
  const cacheServer = init.cache?.server;

  if (options.cache && cacheServer) {
    cacheKey = await getCacheKey(url, options);
    const cached = await cacheServer.get(cacheKey);
    if (cached != null) {
      try {
        const ts = performance.now();
        const { finalUrl, body } = extractFinalUrl(cached);
        const resp = ProcessResponse(
          finalUrl || url,
          body,
          ts,
          options.parseJSON!,
          true,
        );
        const built = BuildResponse<T>(resp, options, init);
        return options.transformResponse
          ? options.transformResponse(built)
          : built;
      } catch {
        console.warn(
          `[BunCurl2] - Corrupted cache entry, skipping [${cacheKey}]`,
        );
      }
    }
  }

  concurrentRequests++;
  let proc: Bun.Subprocess | undefined;
  try {
    const tsStart = performance.now();
    const cmd = await BuildCommand<T>(new URL(url), options, init);
    proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });

    // helper to narrow proc.stdout into a ReadableStream<Uint8Array>
    const stdoutPromise = (async () => {
      if (!proc!.stdout) throw new Error('[BunCurl2] - Missing stdout');
      const outStream =
        typeof proc!.stdout === 'number'
          ? Bun.file(proc!.stdout, { type: 'stream' }).stream()
          : proc!.stdout;
      const buf = await new Response(
        outStream as ReadableStream<Uint8Array>,
      ).arrayBuffer();
      return Buffer.from(buf).toString('binary');
    })();

    const abortPromise = new Promise<never>((_, reject) => {
      if (options.signal) {
        if (options.signal.aborted) {
          proc!.kill();
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        } else {
          options.signal.addEventListener(
            'abort',
            () => {
              proc!.kill();
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
      await proc!.exited;
      throw err;
    }

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderrData = await (async () => {
        if (!proc!.stderr) throw new Error('[BunCurl2] - Missing stderr');
        const errStream =
          typeof proc!.stderr === 'number'
            ? Bun.file(proc!.stderr, { type: 'stream' }).stream()
            : proc!.stderr;
        const buf = await new Response(
          errStream as ReadableStream<Uint8Array>,
        ).arrayBuffer();
        return Buffer.from(buf).toString('utf-8');
      })();

      const msg = stderrData.trim().replace(/curl:\s*\(\d+\)\s*/, '');
      throw Object.assign(new Error(`[BunCurl2] - ${msg}`), {
        code: 'ERR_CURL_FAILED',
        exitCode: proc.exitCode,
        options: { ...options, url },
      });
    }

    const { finalUrl, body } = extractFinalUrl(stdout);
    const resp = ProcessResponse(
      finalUrl || url,
      body,
      tsStart,
      options.parseJSON!,
      false,
    );
    const builtRes = BuildResponse<T>(resp, options, init);

    if (cacheKey && cacheServer && typeof options.cache === 'object') {
      if (
        typeof options.cache.validate === 'function' &&
        !(await options.cache.validate(builtRes))
      ) {
        return options.transformResponse
          ? options.transformResponse(builtRes)
          : builtRes;
      }

      const expire =
        typeof options.cache.expire === 'number'
          ? options.cache.expire
          : init.cache!.defaultExpiration!;

      if (cacheServer instanceof LocalCache) {
        cacheServer.set(cacheKey, stdout, expire);
      } else if (cacheServer instanceof RedisClient) {
        await cacheServer.send('SET', [
          cacheKey,
          stdout,
          'PX',
          String(expire * 1000 - 5),
          'NX',
        ]);
      } else {
        await cacheServer.set(cacheKey, stdout, {
          expiration: { type: 'EX', value: expire },
          condition: 'NX',
        });
      }
    }

    return options.transformResponse
      ? options.transformResponse(builtRes)
      : builtRes;
  } finally {
    concurrentRequests--;
  }
}

async function getCacheKey<T>(
  url: string,
  options: RequestInit<T>,
): Promise<string> {
  if (typeof options.cache === 'object' && options.cache.generate)
    return options.cache.generate({ url, ...options });
  return generateCacheKey(url, options);
}

function prepareOptions<T>(
  options: RequestInit<T>,
  init: GlobalInit & { cache?: CacheInstance },
) {
  options.parseJSON = options.parseJSON ?? init.parseJSON ?? true;
  options.method = options.method ?? 'GET';
  options.compress = options.compress ?? init.compress ?? true;
  options.follow = options.follow ?? true;
  options.sortHeaders = options.sortHeaders ?? true;
  init.tcp = init.tcp ?? {};
  init.tcp.fastOpen = init.tcp.fastOpen ?? true;
  init.tcp.noDelay = init.tcp.noDelay ?? true;
  if (init.cache)
    init.cache.defaultExpiration = init.cache.defaultExpiration ?? 5;
}

function generateCacheKey<T>(url: string, options: RequestInit<T>): string {
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

function serializeField<T>(
  key: CacheKeys,
  options: RequestInit<T>,
  url: string,
): string {
  let val: unknown = key === 'url' ? url : (options as any)[key];
  if (val instanceof Headers) {
    val = Array.from(val.entries()).map(([h, v]) => h + v);
  }
  return hasJsonStructure(val as any)
    ? JSON.stringify(val as any)
    : String(val);
}
