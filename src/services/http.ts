import type {
  CacheKeys,
  GlobalInit,
  RequestInit,
  ResponseInit,
  CacheInstance,
} from '../types';
import BuildCommand from './command';
import { processAndBuild } from './response';
import { hasJsonStructure, md5 } from '../models/utils';
import TTLCache from './cache';
import { RedisClient } from 'bun';
import { TLS } from '../models/constants';

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

export default async function Http<T = any, U extends boolean = false>(
  url: string,
  options: RequestInit<T, U> = {},
  init: GlobalInit & { redirectsAsUrls?: U; cache?: CacheInstance } = {},
): Promise<ResponseInit<T, U>> {
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
        const resp = processAndBuild<T, U>(
          url,
          cached,
          ts,
          options.parseJSON!,
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
  let proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
  try {
    const tsStart = performance.now();
    const cmd = await BuildCommand<T, U>(new URL(url), options, init);
    proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });

    const stdoutPromise = (async () => {
      if (!proc.stdout) throw new Error('[BunCurl2] - Missing stdout');
      const buf = await new Response(proc.stdout).arrayBuffer();
      return Buffer.from(buf).toString('binary');
    })();

    const abortPromise = new Promise<never>((_, reject) => {
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
      options.parseJSON!,
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

      const expireMs = (typeof options.cache.expire === 'number' ? options.cache.expire : init.cache!.defaultExpiration!) * 1e3;

      if (cacheServer instanceof TTLCache) {
        cacheServer.set(cacheKey, stdout, expireMs);
      } else if (cacheServer instanceof RedisClient) {
        // Bun checks by ">" operator instead of ">=" 
        // So we substract 1ms from expiration time to make sure it matches the logic of redis package
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
    servers: ['1.1.1.1', '1.0.0.1']
  };
  options.tls = options.tls ?? {
    versions: [TLS.Version13, TLS.Version12],
    ciphers: {
      DEFAULT: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
      TLS13: 'TLS_AES_128_GCM_SHA256'
    }
  };
  options.parseJSON = options.parseJSON ?? init.parseJSON ?? true;
  options.method = options.method ?? 'GET';
  options.compress = options.compress ?? init.compress ?? true;
  options.follow = options.follow ?? true;
  options.sortHeaders = options.sortHeaders ?? true;
  options.http = options.http ?? {
    keepAlive: true,
    keepAliveProbes: 3
  };
  init.tcp = init.tcp ?? {
    fastOpen: true,
    noDelay: true
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
  return hasJsonStructure(val as any)
    ? JSON.stringify(val as any)
    : String(val);
}
