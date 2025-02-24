import type { Initialize, RequestInit, Response } from '../@types/Options';
import BuildCommand from './command';
import { BuildResponse, ProcessResponse } from './response';
import { type CacheType } from '../@types/Options';
import { md5 } from '../models/utils';

export default async function Http<T = any>(
  url: string,
  options: RequestInit = {},
  init: Initialize & { cache?: Omit<CacheType, 'options'> } = {}
): Promise<Response<T>> {
  const startTime = performance.now();

  options.parseResponse = options.parseResponse ?? true;

  let key: string | undefined;

  if (options.cache !== undefined && init.cache?.server) {
    const defaultKeys: (keyof RequestInit)[] = ['headers', 'body', 'proxy'];
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
        return BuildResponse<T>({ ...response, cached: true }, options, init);
      } catch {}
    }
  }

  const cmd = BuildCommand<T>(url, options, init);

  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = Buffer.from(
    await new Response(proc.stdout).arrayBuffer()
  ).toString('binary');

  if (key && init.cache?.server && options.cache) {
    const expirationSeconds =
      typeof options.cache === 'object'
        ? (options.cache.expire ?? init.cache.defaultExpiration ?? 300)
        : 300;
    await init.cache.server.set(key, stdout, { EX: expirationSeconds });
  }

  const response = ProcessResponse(
    url,
    stdout,
    startTime,
    options.parseResponse
  );

  return BuildResponse<T>(response, options, init);
}
