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

export default async function Http<T = any>(
  url: string,
  options: RequestInit<T> = {},
  init: GlobalInit & { cache?: CacheInstance } = {},
): Promise<ResponseInit<T>> {
  prepareOptions(options, init);

  const maxConcurrent = init.maxConcurrentRequests ?? 250;
  if (concurrentRequests >= maxConcurrent) {
    throw Object.assign(
      new Error(
        `[BunCurl2] - Maximum concurrent requests (${maxConcurrent}) reached`,
      ),
      { code: 'ERR_CONCURRENT_REQUESTS_REACHED', options: { ...options, url } },
    );
  }

  let cacheKey: string | undefined;
  if (options.cache && init.cache?.server) {
    if (typeof options.cache === 'object' && options.cache.generate) {
      cacheKey = await options.cache.generate({ url, ...options });
    } else {
      cacheKey = generateCacheKey(url, options);
    }
    const cached = await init.cache.server.get(cacheKey);
    if (cached != null) {
      try {
        const ts = performance.now();
        const { finalUrl, body } = extractFinalUrl(cached);
        const resp = ProcessResponse(finalUrl || url, body, ts, options.parseJSON!, true);
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

  const tsStart = performance.now();
  const cmd = await BuildCommand<T>(new URL(url), options, init);
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });

  const stdoutPromise = (async () => {
    const buf = await new Response(proc.stdout).arrayBuffer();
    return Buffer.from(buf).toString('binary');
  })();

  const stderrPromise = (async () => {
    const buf = await new Response(proc.stderr).arrayBuffer();
    return Buffer.from(buf).toString('utf-8');
  })();

  const abortPromise = new Promise<never>((_res, reject) => {
    if (options.signal) {
      if (options.signal.aborted) {
        proc.kill();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
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
    concurrentRequests--;
    throw err;
  }

  await proc.exited;
  concurrentRequests--;
  const stderrData = await stderrPromise;

  if (proc.exitCode !== 0) {
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

  if (cacheKey && init.cache?.server && typeof options.cache === 'object') {
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

    if (init.cache.server instanceof LocalCache) {
      init.cache.server.set(cacheKey, stdout, expire);
    } else if (init.cache.server instanceof RedisClient) {
      // There's some type of expiration delay within Bun redis API so we need to
      // Make it expire atleast 2ms earlier
      // Not perfect but i couldn't think of anything else :(
      await init.cache.server.send('SET', [
        cacheKey,
        stdout,
        'PX',
        String(expire * 1000 - 2),
        'NX',
      ]);
    } else {
      await init.cache.server.set(cacheKey, stdout, {
        expiration: {
          type: 'EX',
          value: expire,
        },
        condition: 'NX',
      });
    }
  }

  return options.transformResponse
    ? options.transformResponse(builtRes)
    : builtRes;
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
