import type { GlobalInit, RequestInit, RequestInitWithURL } from '../types';
import { Buffer } from 'buffer';
import { dns } from 'bun';
import {
  CURL,
  CURL_VERSION,
  CURL_OUTPUT,
  TLS,
  DNS_CACHE,
  HTTP,
  PROTOCOL_PORTS,
} from '../models/constants';
import formatProxyString from '../models/proxy';
import {
  compareVersions,
  containsAlphabet,
  determineContentType,
  hasJsonStructure,
  isValidIPv4,
} from '../models/utils';
import { sortHeaders } from '../models/headers';

const encoder = new TextEncoder();

const BASE_CURL_FLAGS = [CURL.INFO, CURL.SILENT, CURL.SHOW_ERROR] as const;

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

  const parts: Buffer[] = [];

  for (const [key, value] of formData.entries() as unknown as [string, any]) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"`;
    if (value instanceof Blob) {
      const file = value as File;
      header += `; filename="${file.name || 'file'}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
      parts.push(Buffer.from(encoder.encode(header)));
      parts.push(Buffer.from(await file.arrayBuffer()));
      parts.push(Buffer.from('\r\n'));
    } else {
      header += '\r\n\r\n';
      parts.push(Buffer.from(encoder.encode(header)));
      parts.push(Buffer.from(encoder.encode(String(value))));
      parts.push(Buffer.from('\r\n'));
    }
  }

  parts.push(Buffer.from(encoder.encode(`--${boundary}--\r\n`)));
  return { body: Buffer.concat(parts), boundary };
}

async function prepareRequestBody(body: unknown) {
  if (typeof body === 'string') {
    return { body, type: determineContentType(body) };
  }

  if (body instanceof URLSearchParams) {
    return { body: body.toString(), type: 'application/x-www-form-urlencoded' };
  }

  if ((body as any) instanceof FormData) {
    const { body: bd, boundary } = await buildMultipartBody(body as FormData);
    return { body: bd, type: `multipart/form-data; boundary=${boundary}` };
  }

  if (
    (body as any) instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  ) {
    const arr = (body as Blob).arrayBuffer
      ? await (body as Blob).arrayBuffer()
      : ArrayBuffer.isView(body)
        ? (body as ArrayBufferView).buffer
        : (body as ArrayBuffer);
    return { body: Buffer.from(arr as ArrayBuffer) };
  }

  if ((body as any) instanceof ReadableStream) {
    const reader = (body as ReadableStream).getReader();
    const chunks: Buffer[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return { body: Buffer.concat(chunks) };
  }

  if (typeof body === 'object' && body !== null && hasJsonStructure(body)) {
    const jsonStr = JSON.stringify(body);
    return { body: jsonStr, type: 'application/json' };
  }

  const str = String(body);
  return { body: str, type: determineContentType(str) };
}

function prepareHeaders(
  headers: RequestInit['headers'],
  sort: boolean,
): [string, string][] {
  if (!headers) return [];
  if (sort) return sortHeaders(headers);

  if (headers instanceof Headers) {
    return Array.from(headers.entries());
  }

  if (Array.isArray(headers)) {
    const out = new Array<[string, string]>(headers.length);
    for (let i = 0; i < headers.length; i++) {
      const [k, v] = headers[i];
      out[i] = [k, String(v)];
    }
    return out;
  }

  const entries = Object.entries(headers);
  const out = new Array<[string, string]>(entries.length);
  for (let i = 0; i < entries.length; i++) {
    const [k, v] = entries[i];
    out[i] = [k, String(v)];
  }
  return out;
}

function buildTLSOptions<T, U extends boolean>(
  options: RequestInit<T, U>,
  cmd: string[],
) {
  const tlsOpts = options.tls;
  if (!tlsOpts) return;

  if (tlsOpts.insecure) cmd.push(CURL.INSECURE);

  const tlsVers = tlsOpts.versions ?? [TLS.Version12, TLS.Version13];
  let low = tlsVers[0];
  let high = tlsVers[0];
  for (let i = 1; i < tlsVers.length; i++) {
    const v = tlsVers[i];
    if (v < low) low = v;
    if (v > high) high = v;
  }

  const tlsMap: Record<number, { flag: string; str: string }> = {
    769: { flag: CURL.TLSv1_0, str: '1.0' },
    770: { flag: CURL.TLSv1_1, str: '1.1' },
    771: { flag: CURL.TLSv1_2, str: '1.2' },
    772: { flag: CURL.TLSv1_3, str: '1.3' },
  };

  const lo = tlsMap[low];
  if (lo) cmd.push(lo.flag);

  const hi = tlsMap[high];
  if (hi) cmd.push(CURL.TLS_MAX, hi.str);

  const c = tlsOpts.ciphers;
  if (c) {
    const { DEFAULT, TLS13 } = c;
    if (DEFAULT) {
      cmd.push(
        CURL.CIPHERS,
        Array.isArray(DEFAULT) ? DEFAULT.join(':') : DEFAULT,
      );
    }
    if (TLS13 && high >= 772) {
      cmd.push(
        CURL.TLS13_CIPHERS,
        Array.isArray(TLS13) ? TLS13.join(':') : TLS13,
      );
    }
  }
}

async function buildDNSOptions<T, U extends boolean>(
  url: URL,
  options: RequestInit<T, U>,
  cmd: string[],
) {
  const dnsOpts = options.dns;
  if (!dnsOpts) return;

  if (dnsOpts.servers && SUPPORTS.DNS_SERVERS) {
    cmd.push(CURL.DNS_SERVERS, dnsOpts.servers.join(','));
  }

  if (dnsOpts.cache && SUPPORTS.DNS_RESOLVE && containsAlphabet(url.host)) {
    let resolveIP = dnsOpts.resolve;
    const cached = DNS_CACHE.get(url.host);

    if (!resolveIP) {
      if (cached) {
        resolveIP = cached;
      } else {
        try {
          const [rec] = await dns.lookup(url.host, { family: 4 });
          resolveIP = rec?.address;
        } catch {}
      }
    }

    if (resolveIP && isValidIPv4(resolveIP)) {
      if (!cached) {
        DNS_CACHE.set(
          url.host,
          resolveIP,
          typeof dnsOpts.cache === 'number' ? dnsOpts.cache : 30,
        );
      }
      const port = PROTOCOL_PORTS[url.protocol] ?? '443';
      cmd.push(CURL.DNS_RESOLVE, `${url.host}:${port}:${resolveIP}`);
    }
  }
}

export default async function BuildCommand<T, U extends boolean>(
  url: URL,
  options: RequestInit<T, U>,
  init: GlobalInit,
): Promise<{ url: URL; cmd: string[] }> {
  let urlStr = url.toString();

  const tr1 = options.transformRequest;
  const tr2 = init.transformRequest;

  if (typeof tr1 === 'function') {
    const tr = tr1({ ...(options as any), url: urlStr }) as RequestInitWithURL<
      T,
      U
    >;
    url = new URL(tr.url);
    urlStr = tr.url;
  } else if (typeof tr2 === 'function' && tr1 !== false) {
    const tr = tr2({ ...(options as any), url: urlStr }) as RequestInitWithURL<
      T,
      U
    >;
    url = new URL(tr.url);
    urlStr = tr.url;
  }

  const maxTime = options.maxTime ?? 10;
  const connTimeout = options.connectionTimeout ?? 5;
  const method = (options.method ?? 'GET').toUpperCase();
  const version =
    options.http?.version ??
    (SUPPORTS.HTTP2 && url.protocol === 'https:'
      ? HTTP.Version20
      : HTTP.Version11);

  const cmd: string[] = [init.executablePath || 'curl', ...BASE_CURL_FLAGS];

  cmd.push(
    CURL.TIMEOUT,
    String(maxTime),
    CURL.CONNECT_TIMEOUT,
    String(connTimeout),
    CURL.HTTP_VERSION[version],
  );

  buildTLSOptions(options, cmd);
  await buildDNSOptions(url, options, cmd);

  if (options.compress && method !== 'HEAD') cmd.push(CURL.COMPRESSED);

  if (init.tcp?.fastOpen && SUPPORTS.TCP_FASTOPEN) cmd.push(CURL.TCP_FASTOPEN);
  if (init.tcp?.noDelay && SUPPORTS.TCP_NODELAY) cmd.push(CURL.TCP_NODELAY);

  if (options.proxy) cmd.push(CURL.PROXY, formatProxyString(options.proxy));
  if (options.interface) cmd.push(CURL.INTERFACE, options.interface);

  const followVal = options.follow ?? true;
  if (followVal) {
    cmd.push(
      CURL.FOLLOW,
      CURL.MAX_REDIRS,
      String(typeof followVal === 'number' ? followVal : 10),
    );
  }

  if (version === HTTP.Version11) {
    const ka = options.http?.keepAlive;
    if (ka === false || ka === 0) {
      cmd.push(CURL.NO_KEEPALIVE);
    } else if (typeof ka === 'number') {
      cmd.push(CURL.KEEPALIVE_TIME, String(ka));
    }
    const kap = options.http?.keepAliveProbes;
    if (typeof kap === 'number') {
      cmd.push(CURL.KEEPALIVE_CNT, String(kap));
    }
  }

  let prepared: { body: string | Buffer; type?: string } | undefined;
  if (options.body !== undefined && options.body !== null) {
    prepared = await prepareRequestBody(options.body);
    if (typeof prepared.body === 'string') {
      cmd.push(CURL.DATA_RAW, prepared.body);
    } else {
      cmd.push(CURL.DATA_RAW, prepared.body.toString());
    }
  }

  const ordered = prepareHeaders(options.headers, !!options.sortHeaders);

  let hasCt = false;
  let ua = init.defaultAgent ?? `Bun/${Bun.version}`;
  let cookie: string | undefined;

  for (let i = 0; i < ordered.length; i++) {
    const [k, v] = ordered[i];
    const lower = k.toLowerCase();

    if (lower === 'content-type') {
      hasCt = true;
      cmd.push(CURL.HEADER, `${k}: ${v}`);
      continue;
    }

    if (lower === 'user-agent') {
      ua = v;
      continue;
    }

    if (lower === 'cookie') {
      cookie = cookie ? `${cookie}; ${v}` : v;
      continue;
    }

    cmd.push(CURL.HEADER, `${k}: ${v}`);
  }

  cmd.push(CURL.USER_AGENT, ua);
  if (cookie) cmd.push(CURL.COOKIE, cookie);

  if (prepared?.type && !hasCt) {
    cmd.push(CURL.HEADER, `content-type: ${prepared.type}`);
  }

  if (method === 'HEAD') cmd.push(CURL.HEAD);
  else cmd.push(CURL.METHOD, method);

  if (urlStr.indexOf('[') !== -1 || urlStr.indexOf(']') !== -1) {
    urlStr = urlStr.replace(/\[|\]/g, (c) => (c === '[' ? '%5B' : '%5D'));
  }

  cmd.push(urlStr);

  return { url, cmd };
}