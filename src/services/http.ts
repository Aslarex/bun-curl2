import type {
  GlobalInit,
  RedisServer,
  RequestInit,
  ResponseInit,
} from '../@types/Options';
import BuildCommand from './command';
import { BuildResponse, ProcessResponse } from './response';
import { extractFinalUrl, md5 } from '../models/utils';
import { LocalCache } from './local_cache';

export default async function Http<T = any>(
  url: string,
  options: RequestInit<T> = {},
  init: GlobalInit & {
    cache?: {
      server: RedisServer | LocalCache<string>;
      defaultExpiration?: number;
    };
  } = {}
): Promise<ResponseInit<T>> {
  // Validate URL
  new URL(url);

  const startTime = performance.now();

  options.parseResponse ??= init.parseResponse ?? true;
  options.method ??= 'GET';

  if (init.cache) {
    init.cache.defaultExpiration ??= 5;
  }

  let key: string | undefined;

  // Handle caching if enabled.
  if (options.cache && init.cache?.server) {
    const defaultKeys: (keyof RequestInit)[] = [
      'headers',
      'body',
      'proxy',
      'method',
    ];
    const keys =
      typeof options.cache === 'boolean' || !options.cache.keys
        ? defaultKeys.map(e => options[e])
        : options.cache.keys.map(e => options[e]);
    key = md5(`BunCurl2|${url}|` + keys.join('|'));

    const getCachedRes = await init.cache.server.get(key);
    if (getCachedRes) {
      try {
        const response = ProcessResponse(
          url,
          getCachedRes,
          startTime,
          options.parseResponse
        );
        const builtResponse = BuildResponse<T>(
          { ...response, cached: true },
          options,
          init
        );
        return options.transformResponse
          ? options.transformResponse(builtResponse)
          : builtResponse;
      } catch {
        // If processing cached response fails, continue to execute the command.
      }
    }
  }

  // Build the command and spawn the process.
  const cmd = await BuildCommand<T>(url, options, init);
  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Promises to capture stdout and stderr.
  const stdoutPromise = (async () => {
    const buffer = await new Response(proc.stdout).arrayBuffer();
    return Buffer.from(buffer).toString('binary');
  })();

  const stderrPromise = (async () => {
    const buffer = await new Response(proc.stderr).arrayBuffer();
    return Buffer.from(buffer).toString('utf-8');
  })();

  // Abort promise to handle cancellation.
  const abortPromise = new Promise<never>((_resolve, reject) => {
    if (options.signal) {
      if (options.signal.aborted) {
        proc.kill();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      } else {
        const onAbort = () => {
          proc.kill();
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });

  let stdout: string;
  try {
    stdout = await Promise.race([stdoutPromise, abortPromise]);
  } catch (error) {
    throw error;
  } finally {
    await proc.exited;
  }

  const stderrData = await stderrPromise;

  // Check the exit code for errors.
  if (proc.exitCode !== 0) {
    const errorMessage = `[BunCurl2] - ${stderrData.trim().replace(/curl:\s*\(\d+\)\s*/, '')}`;
    throw Object.assign(new Error(errorMessage), {
      code: 'ERR_CURL_FAILED',
      exitCode: proc.exitCode,
      options: { ...options, url },
    });
  }

  const extractURL = extractFinalUrl(stdout);

  if (extractURL.finalUrl) {
    url = extractURL.finalUrl;
    stdout = extractURL.body;
  }

  const response = ProcessResponse(
    url,
    stdout,
    startTime,
    options.parseResponse
  );
  const builtResponse = BuildResponse<T>(response, options, init);

  // Update cache if necessary.
  if (key && init.cache?.server && options.cache) {
    if (typeof options.cache === 'object' && options.cache.validate) {
      const validate = await options.cache.validate(builtResponse);
      if (!validate) return builtResponse;
    }
    const expirationSeconds =
      typeof options.cache === 'object' && options.cache.expire
        ? options.cache.expire
        : init.cache.defaultExpiration!;
    if (init.cache.server instanceof LocalCache) {
      init.cache.server.set(key, stdout, expirationSeconds);
    } else {
      await init.cache.server.set(key, stdout, {
        EX: expirationSeconds,
        NX: true,
      });
    }
  }

  return options.transformResponse
    ? options.transformResponse(builtResponse)
    : builtResponse;
}
