import type { GlobalInit, RequestInit } from '../types';
import {
  CURL,
  DEFAULT_DNS_SERVERS,
  CURL_VERSION,
  CURL_OUTPUT,
  TLS,
  DNS_CACHE_MAP,
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
import { Buffer } from 'buffer';
import { dns } from 'bun';

const SUPPORTS = {
  HTTP2: CURL_OUTPUT.indexOf('http2') !== -1,
  DNS_SERVERS: CURL_OUTPUT.indexOf('c-ares') !== -1,
  DNS_RESOLVE: compareVersions(CURL_VERSION, '7.21.3') >= 0,
  TCP_FASTOPEN: compareVersions(CURL_VERSION, '7.49.0') >= 0,
  TCP_NODELAY: compareVersions(CURL_VERSION, '7.11.2') >= 0,
};

/**
 * Helper: Build a multipart/form-data payload from a FormData instance.
 * Returns a Buffer payload and the boundary string.
 */
async function buildMultipartBody(
  formData: FormData,
): Promise<{ body: Buffer; boundary: string }> {
  const boundary =
    '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts: Buffer[] = [];

  // Collect all entries from FormData.
  const entries: [string, FormDataEntryValue][] = [];
  formData.forEach((value, key) => {
    entries.push([key, value]);
  });

  // Loop over the collected entries sequentially.
  for (const [key, value] of entries) {
    let headers = `--${boundary}\r\nContent-Disposition: form-data; name="${key}"`;
    let contentBuffer: Buffer;

    if (value instanceof Blob) {
      // For file fields, add filename and Content-Type.
      const fileName = (value as File).name || 'file';
      const fileType = (value as File).type || 'application/octet-stream';
      headers += `; filename="${fileName}"\r\nContent-Type: ${fileType}\r\n\r\n`;
      const arrayBuffer = await value.arrayBuffer();
      contentBuffer = Buffer.from(arrayBuffer);
    } else {
      // For normal fields.
      headers += '\r\n\r\n';
      contentBuffer = Buffer.from(String(value), 'utf-8');
    }

    parts.push(Buffer.from(headers, 'utf-8'));
    parts.push(contentBuffer);
    parts.push(Buffer.from('\r\n', 'utf-8'));
  }

  // Append the closing boundary.
  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));

  return { body: Buffer.concat(parts), boundary };
}

/**
 * Helper: Prepare the request body.
 * Converts various body types (string, object, URLSearchParams, FormData, Blob,
 * ReadableStream, or BufferSource) into either a string or Buffer and returns
 * any headers that need to be set.
 */
async function prepareRequestBody(
  body: any,
): Promise<{ body: string | Buffer; type?: string }> {
  // URLSearchParams: convert to URL-encoded string.
  if (body instanceof URLSearchParams) {
    return {
      body: body.toString(),
      type: 'application/x-www-form-urlencoded',
    };
  }

  // FormData: build multipart/form-data.
  if (body instanceof FormData) {
    const { body: multipartBody, boundary } = await buildMultipartBody(body);
    return {
      body: multipartBody,
      type: `multipart/form-data; boundary=${boundary}`,
    };
  }

  // Blob: convert to Buffer.
  if (body instanceof Blob) {
    const arrayBuffer = await body.arrayBuffer();
    return { body: Buffer.from(arrayBuffer) };
  }

  // ReadableStream: read and concatenate all chunks.
  if (body instanceof ReadableStream) {
    const chunks: Uint8Array[] = [];
    const reader = body.getReader();
    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (value) chunks.push(value);
      done = streamDone;
    }
    return { body: Buffer.concat(chunks) };
  }

  // BufferSource: ArrayBuffer or TypedArray.
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return { body: Buffer.from(body as ArrayBuffer) };
  }

  // Plain object: assume JSON.
  if (typeof body === 'object' && hasJsonStructure(body)) {
    return {
      body: JSON.stringify(body),
      type: 'application/json',
    };
  }

  // Fallback: convert to string.
  const strBody = String(body);
  return { body: strBody, type: determineContentType(strBody) };
}

/**
 * Main BuildCommand function.
 * Constructs the curl command for Bun.spawn based on options.
 */
export default async function BuildCommand<T>(
  url: URL,
  options: RequestInit<T>,
  init: GlobalInit,
): Promise<string[]> {
  // ── Transform Request & Set Defaults ──
  const urlString = url.toString();
  if (options.transformRequest) {
    options = options.transformRequest({ url: urlString, ...options });
  } else if (init.transfomRequest && options.transformRequest !== false) {
    options = init.transfomRequest({ url: urlString, ...options });
  }
  const maxTime = options.maxTime ?? 10;
  const connectionTimeout = options.connectionTimeout ?? 5;
  const compress = options.compress!;
  const tls_insecure = options.tls?.insecure ?? false;
  const tls_versions = options.tls?.versions ?? [TLS.Version12, TLS.Version13];
  const httpVersion = options.http?.version ?? (SUPPORTS.HTTP2 ? 2.0 : 1.1);
  const dnsServers = options.dns?.servers ?? DEFAULT_DNS_SERVERS;
  const method = options.method!.toUpperCase();

  // ── Build Base Command ──
  const command: string[] = [
    CURL.BASE,
    CURL.INFO,
    CURL.SILENT,
    CURL.SHOW_ERROR,
    CURL.WRITE_OUT,
    '\nFinal-Url:%{url_effective}',
    CURL.TIMEOUT,
    maxTime.toString(),
    CURL.CONNECT_TIMEOUT,
    connectionTimeout.toString(),
    CURL.HTTP_VERSION[httpVersion],
  ];

  // ── Append TLS & Cipher Settings ──
  if (tls_insecure) command.push(CURL.INSECURE);
  const tlsMap: Record<number, { flag: string; str: string }> = {
    769: { flag: CURL.TLSv1_0, str: '1.0' },
    770: { flag: CURL.TLSv1_1, str: '1.1' },
    771: { flag: CURL.TLSv1_2, str: '1.2' },
    772: { flag: CURL.TLSv1_3, str: '1.3' },
  };
  if (tls_versions.length) {
    const lowest = Math.min(...tls_versions);
    const highest = Math.max(...tls_versions);
    if (tlsMap[lowest]) command.push(tlsMap[lowest].flag);
    if (tlsMap[highest]) command.push(CURL.TLS_MAX, tlsMap[highest].str);
  }
  if (options.tls?.ciphers) {
    const ciphers = options.tls.ciphers;
    if (ciphers.DEFAULT) {
      command.push(
        CURL.CIPHERS,
        typeof ciphers.DEFAULT === 'string'
          ? ciphers.DEFAULT
          : ciphers.DEFAULT.join(':'),
      );
    }
    if (ciphers.TLS13 && tls_versions.includes(772)) {
      command.push(
        CURL.TLS13_CIPHERS,
        typeof ciphers.TLS13 === 'string'
          ? ciphers.TLS13
          : ciphers.TLS13.join(':'),
      );
    }
  }

  // ── Append Compression, DNS Servers & DNS Resolve ──
  if (compress && method !== 'HEAD') command.push(CURL.COMPRESSED);
  if (SUPPORTS.DNS_SERVERS)
    command.push(CURL.DNS_SERVERS, dnsServers.join(','));

  if (SUPPORTS.DNS_RESOLVE && containsAlphabet(url.host)) {
    let resolveIP: string | null = null;
    let cachedIP = DNS_CACHE_MAP.get(url.host) || undefined;
    if ((options.dns?.resolve ?? options.dns?.cache !== false) && cachedIP) {
      resolveIP = cachedIP;
    } else {
      try {
        const lookup = await dns.lookup(url.host, { family: 4 });
        if (lookup.length) resolveIP = lookup[0].address;
      } catch {}
    }
    if (resolveIP && isValidIPv4(resolveIP)) {
      if (options.dns?.cache !== false && !cachedIP) {
        DNS_CACHE_MAP.set(url.host, resolveIP, options.dns?.cache ?? 300);
      }
      const port = getDefaultPort(url.protocol);
      command.push(CURL.DNS_RESOLVE, `${url.host}:${port}:${resolveIP}`);
    }
  }

  // ── Append TCP Options & Proxy ──
  if (init.tcp?.fastOpen && SUPPORTS.TCP_FASTOPEN)
    command.push(CURL.TCP_FASTOPEN);
  if (init.tcp?.noDelay && SUPPORTS.TCP_NODELAY) command.push(CURL.TCP_NODELAY);
  if (options.proxy) command.push(CURL.PROXY, formatProxyString(options.proxy));

  // ── Append Follow Redirect & HTTP Keep-Alive Options ──
  if (options.follow !== undefined && options.follow !== false) {
    command.push(
      CURL.FOLLOW,
      CURL.MAX_REDIRS,
      typeof options.follow === 'number' ? options.follow.toString() : '10',
    );
  }
  if (httpVersion === 1.1) {
    if (options.http?.keepAlive === false || options.http?.keepAlive === 0) {
      command.push(CURL.NO_KEEPALIVE);
    } else if (typeof options.http?.keepAlive === 'number') {
      command.push(CURL.KEEPALIVE_TIME, options.http.keepAlive.toString());
    }
    if (typeof options.http?.keepAliveProbes === 'number') {
      command.push(CURL.KEEPALIVE_CNT, options.http.keepAliveProbes.toString());
    }
  }

  // ── Prepare Request Body ──
  let prepared: { body: string | Buffer; type?: string } | undefined;
  if (options.body) {
    prepared = await prepareRequestBody(options.body);
    const bodyData =
      typeof prepared.body === 'string'
        ? prepared.body
        : prepared.body.toString('utf-8');
    command.push(CURL.DATA_RAW, bodyData);
  }

  // ── Append Headers (Combined Loop) ──
  // We combine header extraction and command push in one loop.
  // The user-agent header is deliberately skipped so it can be added via CURL.USER_AGENT.
  let headerKeys = new Set<string>(),
    userAgent: string = init.defaultAgent || `Bun/${Bun.version}`;
  if (options.headers) {
    if (options.headers instanceof Headers) {
      for (const [key, value] of options.headers.entries()) {
        const lowerKey = key.toLowerCase();
        headerKeys.add(lowerKey);
        if (lowerKey !== 'user-agent') {
          command.push(CURL.HEADER, `${key}: ${value}`);
        } else userAgent = value;
      }
    } else {
      for (const [key, value] of Object.entries(options.headers)) {
        if (value !== undefined) {
          const lowerKey = key.toLowerCase();
          headerKeys.add(lowerKey);
          if (lowerKey !== 'user-agent') {
            command.push(CURL.HEADER, `${key}: ${value}`);
          } else userAgent = value;
        }
      }
    }
  }
  // Always add user-agent using -A flag.
  command.push(CURL.USER_AGENT, userAgent);

  if (prepared && prepared.type && !headerKeys.has('content-type')) {
    command.push(CURL.HEADER, `content-type: ${prepared.type}`);
  }

  // ── Append HTTP Method & Final URL ──
  method === 'HEAD'
    ? command.push(CURL.HEAD)
    : command.push(CURL.METHOD, method);
  command.push(
    urlString.replace(/[\[\]]/g, char => (char === '[' ? '%5B' : '%5D')),
  );

  return command;
}
