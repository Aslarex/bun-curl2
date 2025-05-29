import type { GlobalInit, RequestInit } from '../types';
import { Buffer } from 'buffer';
import { dns } from 'bun';
import {
  CURL,
  CURL_VERSION,
  CURL_OUTPUT,
  TLS,
  DNS_CACHE_MAP,
  HTTP,
} from '../models/constants';
import formatProxyString from '../models/proxy';
import {
  compareVersions,
  containsAlphabet,
  determineContentType,
  getDefaultPort,
  hasJsonStructure,
  isValidIPv4,
} from '../models/utils';
import { sortHeaders } from '../models/headers';

const SUPPORTS = {
  HTTP2: CURL_OUTPUT.includes('http2'),
  HTTP3: CURL_OUTPUT.includes('http3'),
  DNS_SERVERS: CURL_OUTPUT.includes('c-ares'),
  DNS_RESOLVE: compareVersions(CURL_VERSION, '7.21.3') >= 0,
  TCP_FASTOPEN: compareVersions(CURL_VERSION, '7.49.0') >= 0,
  TCP_NODELAY: compareVersions(CURL_VERSION, '7.11.2') >= 0,
};

async function buildMultipartBody(formData: FormData) {
  const boundary =
    '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const parts: Uint8Array[] = [];

  for (const [key, value] of Array.from<any>(formData.entries())) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"`;
    let chunk: Uint8Array;

    if (value instanceof Blob) {
      const file = value as unknown as File;
      header += `; filename="${file.name || 'file'}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
      chunk = new Uint8Array(await file.arrayBuffer());
    } else {
      header += '\r\n\r\n';
      chunk = new TextEncoder().encode(String(value));
    }

    parts.push(
      new TextEncoder().encode(header),
      chunk,
      new TextEncoder().encode('\r\n'),
    );
  }

  parts.push(new TextEncoder().encode(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts.map((u) => Buffer.from(u))), boundary };
}

async function prepareRequestBody(body: unknown) {
  if (body instanceof URLSearchParams) {
    return { body: body.toString(), type: 'application/x-www-form-urlencoded' };
  }

  if (body instanceof FormData) {
    const { body: bd, boundary } = await buildMultipartBody(body);
    return { body: bd, type: `multipart/form-data; boundary=${boundary}` };
  }

  if (
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    const arr =
      body instanceof Blob ? await body.arrayBuffer() : (body as ArrayBuffer);
    return { body: Buffer.from(arr) };
  }

  if (body instanceof ReadableStream) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return { body: Buffer.concat(chunks.map((c) => Buffer.from(c))) };
  }

  if (typeof body === 'object' && body !== null && hasJsonStructure(body)) {
    return { body: JSON.stringify(body), type: 'application/json' };
  }

  const str = String(body);
  return { body: str, type: determineContentType(str) };
}

const prepareHeaders = (
  headers: RequestInit['headers'],
  sort: boolean,
): [string, string][] => {
  if (!headers) return [];
  if (sort) return sortHeaders(headers);
  return headers instanceof Headers
    ? Array.from(headers)
    : Array.isArray(headers)
      ? headers.map(([k, v]) => [k, String(v)])
      : Object.entries(headers).map(([k, v]) => [k, String(v)]);
};

function buildTLSOptions<T, U extends boolean>(
  options: RequestInit<T, U>,
  cmd: string[],
) {
  const tlsVers = options.tls?.versions ?? [TLS.Version12, TLS.Version13];
  const [low, high] = [Math.min(...tlsVers), Math.max(...tlsVers)];
  const tlsMap: Record<number, { flag: string; str: string }> = {
    769: { flag: CURL.TLSv1_0, str: '1.0' },
    770: { flag: CURL.TLSv1_1, str: '1.1' },
    771: { flag: CURL.TLSv1_2, str: '1.2' },
    772: { flag: CURL.TLSv1_3, str: '1.3' },
  };
  if (options.tls?.insecure) cmd.push(CURL.INSECURE);
  if (tlsMap[low]) cmd.push(tlsMap[low].flag);
  if (tlsMap[high]) cmd.push(CURL.TLS_MAX, tlsMap[high].str);
  if (options.tls?.ciphers) {
    const { DEFAULT, TLS13 } = options.tls.ciphers;
    if (DEFAULT)
      cmd.push(
        CURL.CIPHERS,
        Array.isArray(DEFAULT) ? DEFAULT.join(':') : DEFAULT,
      );
    if (TLS13 && tlsVers.includes(772))
      cmd.push(
        CURL.TLS13_CIPHERS,
        Array.isArray(TLS13) ? TLS13.join(':') : TLS13,
      );
  }
}

async function buildDNSOptions<T, U extends boolean>(
  url: URL,
  options: RequestInit<T, U>,
  cmd: string[],
) {
  if (options.dns?.servers && SUPPORTS.DNS_SERVERS)
    cmd.push(CURL.DNS_SERVERS, options.dns.servers.join(','));

  if (SUPPORTS.DNS_RESOLVE && containsAlphabet(url.host)) {
    let resolveIP = options.dns?.resolve;
    const cached = DNS_CACHE_MAP.get(url.host);
    if (!resolveIP) {
      if (options.dns?.cache && cached) resolveIP = cached;
      else {
        try {
          const [rec] = await dns.lookup(url.host, { family: 4 });
          resolveIP = rec?.address;
        } catch {}
      }
    }
    if (resolveIP && isValidIPv4(resolveIP)) {
      if (options.dns?.cache && !cached)
        DNS_CACHE_MAP.set(
          url.host,
          resolveIP,
          typeof options.dns.cache === 'number' ? options.dns.cache : 30,
        );
      cmd.push(
        CURL.DNS_RESOLVE,
        `${url.host}:${getDefaultPort(url.protocol)}:${resolveIP}`,
      );
    }
  }
}

export default async function BuildCommand<T, U extends boolean>(
  url: URL,
  options: RequestInit<T, U>,
  init: GlobalInit,
): Promise<string[]> {
  const urlStr = url.toString();
  options = options.transformRequest
    ? options.transformRequest({ url: urlStr, ...options })
    : init.transformRequest && options.transformRequest !== false
      ? init.transformRequest({ url: urlStr, ...options })
      : options;

  const maxTime = options.maxTime ?? 10;
  const connTimeout = options.connectionTimeout ?? 5;
  const method = options.method!.toUpperCase();
  const version =
    options.http?.version ??
    (SUPPORTS.HTTP3 && !options.proxy
      ? HTTP.Version30
      : SUPPORTS.HTTP2
        ? HTTP.Version20
        : HTTP.Version11);

  const cmd = [
    CURL.BASE,
    CURL.INFO,
    CURL.SILENT,
    CURL.SHOW_ERROR,
    // CURL.WRITE_OUT,
    // '\nFinal-Url:%{url_effective}',
    CURL.TIMEOUT,
    String(maxTime),
    CURL.CONNECT_TIMEOUT,
    String(connTimeout),
    CURL.HTTP_VERSION[version],
  ];

  buildTLSOptions<T, U>(options, cmd);
  await buildDNSOptions<T, U>(url, options, cmd);

  if (options.compress && method !== 'HEAD') cmd.push(CURL.COMPRESSED);
  if (init.tcp?.fastOpen && SUPPORTS.TCP_FASTOPEN) cmd.push(CURL.TCP_FASTOPEN);
  if (init.tcp?.noDelay && SUPPORTS.TCP_NODELAY) cmd.push(CURL.TCP_NODELAY);
  if (options.proxy) cmd.push(CURL.PROXY, formatProxyString(options.proxy));

  if (options.follow ?? true) {
    cmd.push(
      CURL.FOLLOW,
      CURL.MAX_REDIRS,
      String(typeof options.follow === 'number' ? options.follow : 10),
    );
  }

  if (version === 1.1) {
    if (options.http?.keepAlive === false || options.http?.keepAlive === 0)
      cmd.push(CURL.NO_KEEPALIVE);
    else if (typeof options.http?.keepAlive === 'number')
      cmd.push(CURL.KEEPALIVE_TIME, String(options.http.keepAlive));
    if (typeof options.http?.keepAliveProbes === 'number')
      cmd.push(CURL.KEEPALIVE_CNT, String(options.http.keepAliveProbes));
  }

  let prepared;
  if (options.body) {
    prepared = await prepareRequestBody(options.body);
    const data =
      typeof prepared.body === 'string'
        ? prepared.body
        : prepared.body.toString('utf-8');
    cmd.push(CURL.DATA_RAW, data);
  }

  const ordered = prepareHeaders(options.headers, options.sortHeaders!);
  let hasCt = false;
  let ua = init.defaultAgent ?? `Bun/${Bun.version}`;
  for (const [k, v] of ordered) {
    if (k.toLowerCase() === 'content-type') hasCt = true;
    if (k.toLowerCase() === 'user-agent') ua = v;
    else cmd.push(CURL.HEADER, `${k}: ${v}`);
  }
  cmd.push(CURL.USER_AGENT, ua);
  if (prepared?.type && !hasCt)
    cmd.push(CURL.HEADER, `content-type: ${prepared.type}`);

  if (method === 'HEAD') cmd.push(CURL.HEAD);
  else cmd.push(CURL.METHOD, method);

  cmd.push(urlStr.replace(/\[|\]/g, (c) => (c === '[' ? '%5B' : '%5D')));

  return cmd;
}
