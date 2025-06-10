import type { GlobalInit, RequestInit } from '../types';
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

const headerCache = new WeakMap<any, [string, string][]>();

const BASE_CURL_FLAGS = [CURL.BASE, CURL.INFO, CURL.SILENT, CURL.SHOW_ERROR] as const;

const SUPPORTS = {
  HTTP2: CURL_OUTPUT.includes('http2'),
  HTTP3: CURL_OUTPUT.includes('http3'),
  DNS_SERVERS: CURL_OUTPUT.includes('c-ares'),
  DNS_RESOLVE: compareVersions(CURL_VERSION, '7.21.3') >= 0,
  TCP_FASTOPEN: compareVersions(CURL_VERSION, '7.49.0') >= 0,
  TCP_NODELAY: compareVersions(CURL_VERSION, '7.11.2') >= 0,
};

async function buildMultipartBody(formData: FormData) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
  const parts: Uint8Array[] = [];

  for (const [key, value] of formData.entries() as unknown as [string, any]) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"`;
    let chunk: Uint8Array;

    if (value instanceof Blob) {
      const file = value as File;
      header += `; filename="${file.name || 'file'}"\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
      const arr = await file.arrayBuffer();
      chunk = new Uint8Array(arr);
    } else {
      header += '\r\n\r\n';
      chunk = encoder.encode(String(value));
    }

    parts.push(encoder.encode(header), chunk, encoder.encode('\r\n'));
  }

  parts.push(encoder.encode(`--${boundary}--\r\n`));
  const bodyBuffer = Buffer.concat(parts.map((u) => Buffer.from(u)));
  return { body: bodyBuffer, boundary };
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

  if ((body as any) instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    const arr = (body as Blob).arrayBuffer
      ? await (body as Blob).arrayBuffer()
      : (body as ArrayBuffer);
    return { body: Buffer.from(arr as ArrayBuffer) };
  }

  if ((body as any) instanceof ReadableStream) {
    const reader = (body as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const concatenated = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { body: concatenated };
  }

  if (typeof body === 'object' && body !== null && hasJsonStructure(body)) {
    const jsonStr = JSON.stringify(body);
    return { body: jsonStr, type: 'application/json' };
  }

  const str = String(body);
  return { body: str, type: determineContentType(str) };
}

function prepareHeaders(headers: RequestInit['headers'], sort: boolean): [string, string][] {
  if (!headers) return [];

  const cached = headerCache.get(headers);
  if (cached) return cached;

  let result: [string, string][];
  if (sort) {
    result = sortHeaders(headers);
  } else if (headers instanceof Headers) {
    result = Array.from(headers.entries());
  } else if (Array.isArray(headers)) {
    result = headers.map(([k, v]) => [k, String(v)]);
  } else {
    result = Object.entries(headers).map(([k, v]) => [k, String(v)]);
  }

  headerCache.set(headers, result);
  return result;
}

function buildTLSOptions<T, U extends boolean>(options: RequestInit<T, U>, cmd: string[]) {
  const tlsOpts = options.tls;
  if (!tlsOpts) return;

  if (tlsOpts.insecure) {
    cmd.push(CURL.INSECURE);
  }

  const tlsVers = tlsOpts.versions ?? [TLS.Version12, TLS.Version13];
  const low = Math.min(...tlsVers);
  const high = Math.max(...tlsVers);

  const tlsMap: Record<number, { flag: string; str: string }> = {
    769: { flag: CURL.TLSv1_0, str: '1.0' },
    770: { flag: CURL.TLSv1_1, str: '1.1' },
    771: { flag: CURL.TLSv1_2, str: '1.2' },
    772: { flag: CURL.TLSv1_3, str: '1.3' },
  };

  if (tlsMap[low]) {
    cmd.push(tlsMap[low].flag);
  }
  if (tlsMap[high]) {
    cmd.push(CURL.TLS_MAX, tlsMap[high].str);
  }

  const c = tlsOpts.ciphers;
  if (c) {
    const { DEFAULT, TLS13 } = c;
    if (DEFAULT) {
      cmd.push(
        CURL.CIPHERS,
        Array.isArray(DEFAULT) ? DEFAULT.join(':') : DEFAULT,
      );
    }
    if (TLS13 && tlsVers.indexOf(772) > -1) {
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
  if (!dnsOpts) {
    return;
  }

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
        } catch {
        }
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
      cmd.push(
        CURL.DNS_RESOLVE,
        `${url.host}:${port}:${resolveIP}`,
      );
    }
  }
}

export default async function BuildCommand<T, U extends boolean>(
  url: URL,
  optionsIn: RequestInit<T, U>,
  init: GlobalInit,
): Promise<string[]> {
  const urlStr = url.toString();

  let options = optionsIn;
  const tr1 = options.transformRequest;
  const tr2 = init.transformRequest;
  if (typeof tr1 === 'function') {
    options = tr1({ url: urlStr, ...options }) as RequestInit<T, U>;
  } else if (typeof tr2 === 'function' && tr1 !== false) {
    options = tr2({ url: urlStr, ...options }) as RequestInit<T, U>;
  }

  const maxTime = options.maxTime ?? 10;
  const connTimeout = options.connectionTimeout ?? 5;
  const method = (options.method ?? 'GET').toUpperCase();
  const version =
    options.http?.version ?? (SUPPORTS.HTTP2 ? HTTP.Version20 : HTTP.Version11);

  const cmd: string[] = [...BASE_CURL_FLAGS];
  cmd.push(
    CURL.TIMEOUT,
    String(maxTime),
    CURL.CONNECT_TIMEOUT,
    String(connTimeout),
    CURL.HTTP_VERSION[version],
  );

  buildTLSOptions(options, cmd);

  await buildDNSOptions(url, options, cmd);

  if (options.compress && method !== 'HEAD') {
    cmd.push(CURL.COMPRESSED);
  }

  if (init.tcp?.fastOpen && SUPPORTS.TCP_FASTOPEN) {
    cmd.push(CURL.TCP_FASTOPEN);
  }
  if (init.tcp?.noDelay && SUPPORTS.TCP_NODELAY) {
    cmd.push(CURL.TCP_NODELAY);
  }

  if (options.proxy) {
    cmd.push(CURL.PROXY, formatProxyString(options.proxy));
  }

  const followVal = options.follow ?? true;
  if (followVal) {
    cmd.push(
      CURL.FOLLOW,
      CURL.MAX_REDIRS,
      String(typeof followVal === 'number' ? followVal : 10),
    );
  }

  if (version === HTTP.Version11) {
    if (options.http?.keepAlive === false || options.http?.keepAlive === 0) {
      cmd.push(CURL.NO_KEEPALIVE);
    } else if (typeof options.http?.keepAlive === 'number') {
      cmd.push(CURL.KEEPALIVE_TIME, String(options.http.keepAlive));
    }
    if (typeof options.http?.keepAliveProbes === 'number') {
      cmd.push(CURL.KEEPALIVE_CNT, String(options.http.keepAliveProbes));
    }
  }

  let prepared: { body: string | Buffer; type?: string } | undefined;
  if (options.body !== undefined && options.body !== null) {
    prepared = await prepareRequestBody(options.body);
    if (typeof prepared.body === 'string') {
      cmd.push(CURL.DATA_RAW, prepared.body);
    } else {
      cmd.push(CURL.DATA_RAW, prepared.body.toString('utf-8'));
    }
  }

  const ordered = prepareHeaders(options.headers, !!options.sortHeaders);
  let hasCt = false;
  let ua = init.defaultAgent ?? `Bun/${Bun.version}`;
  for (const [k, v] of ordered) {
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
    cmd.push(CURL.HEADER, `${k}: ${v}`);
  }
  cmd.push(CURL.USER_AGENT, ua);
  if (prepared?.type && !hasCt) {
    cmd.push(CURL.HEADER, `content-type: ${prepared.type}`);
  }

  if (method === 'HEAD') {
    cmd.push(CURL.HEAD);
  } else {
    cmd.push(CURL.METHOD, method);
  }

  cmd.push(urlStr.replace(/\[|\]/g, (c) => (c === '[' ? '%5B' : '%5D')));

  return cmd;
}