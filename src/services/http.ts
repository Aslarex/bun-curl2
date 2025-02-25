import type { GlobalInit, RequestInit, ResponseInit } from '../@types/Options';
import BuildCommand from './command';
import { BuildResponse, ProcessResponse } from './response';
import { type CacheType } from '../@types/Options';
import { md5 } from '../models/utils';

export default async function Http<T = any>(
  url: string,
  options: RequestInit = {},
  init: GlobalInit & { cache?: Omit<CacheType, 'options'> } = {}
): Promise<ResponseInit<T>> {
  const startTime = performance.now();

  options.parseResponse = options.parseResponse ?? init.parseResponse ?? true;
  init.cache &&
    (init.cache.defaultExpiration = init.cache.defaultExpiration ?? 5);

  let key: string | undefined;

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
    key = md5(keys.join('|') + `|${url}`);
    const cached_response = await init.cache.server.get(key);
    if (cached_response) {
      try {
        const response = ProcessResponse(
          url,
          cached_response,
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
      } catch {}
    }
  }

  const cmd = BuildCommand<T>(url, options, init);
  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Create a promise that resolves when the process completes
  const processPromise = (async () => {
    const stdout = Buffer.from(
      await new Response(proc.stdout).arrayBuffer()
    ).toString('binary');
    return stdout;
  })();

  // Create an abort promise that rejects when the signal is aborted.
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
    // Race between the process finishing and the abort signal firing.
    stdout = await Promise.race([processPromise, abortPromise]);
  } finally {
    // Remove the abort event listener if it's still attached.
    if (options.signal) {
      options.signal.removeEventListener('abort', () => {});
    }
  }

  await proc.exited;

  const response = ProcessResponse(
    url,
    stdout,
    startTime,
    options.parseResponse
  );

  const builtResponse = BuildResponse<T>(response, options, init);

  if (key && init.cache?.server && options.cache) {
    // Return response early to prevent caching if user provided validation function and response did not pass the test.
    if (
      typeof options.cache === 'object' &&
      options.cache.validate
    ) {
      const validate = options.cache.validate(builtResponse);
      const lateValidation = validate instanceof Promise ? await validate : validate;
      if (!lateValidation) return builtResponse;
    }

    const expirationSeconds =
      typeof options.cache === 'object' && options.cache.expire
        ? options.cache.expire
        : init.cache.defaultExpiration!;

    await init.cache.server.set(key, stdout, {
      EX: expirationSeconds,
      NX: true,
    });
  }

  return options.transformResponse
    ? options.transformResponse(builtResponse)
    : builtResponse;
}
