import type { Initialize, RequestInit } from '../@types/Options';
import { CURL, CIPHERS } from '../models/constants';
import formatProxyString from '../models/proxy';
import { hasJsonStructure } from '../models/utils';

function determineContentType(body: string): string {
  if (hasJsonStructure(body)) {
    return 'application/json;charset=UTF-8';
  }
  // Regex to check for URL-encoded form data.
  const urlEncodedRegex = /^([^=&]+=[^=&]*)(?:&[^=&]+=[^=&]*)*$/;
  if (urlEncodedRegex.test(body)) {
    return 'application/x-www-form-urlencoded;charset=UTF-8';
  }
  return 'text/plain;charset=UTF-8';
}

export default function BuildCommand<T>(
  url: string,
  options: RequestInit<T>,
  initialized: Initialize
) {
  // Validate URL.
  new URL(url);

  if (options.transformRequest) {
    options = options.transformRequest({ url, ...options });
  } else if (initialized.transfomRequest) {
    options = initialized.transfomRequest({ url, ...options });
  }

  // Set default values.
  const maxTime = options.maxTime ?? 10;
  const connectionTimeout = options.connectionTimeout ?? 5;
  const compress = initialized.compress ?? true;
  const ciphers_tls12 = options.tls?.ciphers?.TLS12 ?? CIPHERS['TLS12'];
  const ciphers_tls13 = options.tls?.ciphers?.TLS13 ?? CIPHERS['TLS13'];
  const tls_versions = options.tls?.versions ?? [1.3, 1.2];
  const httpVersion = options.proxy ? 2.0 : (options.http?.version ?? 2.0);

  // Build the base curl command.
  const command: string[] = [
    CURL.BASE,
    CURL.INFO,
    CURL.TIMEOUT,
    String(maxTime),
    CURL.CONNECT_TIMEOUT,
    String(connectionTimeout),
    CURL.HTTP_VERSION[httpVersion],
  ];

  if (tls_versions.includes(1.2)) {
    command.push(
      CURL.TLSv1_2,
      CURL.CIPHERS,
      Array.isArray(ciphers_tls12) ? ciphers_tls12.join(':') : ciphers_tls12
    );
  }

  if (tls_versions.includes(1.3)) {
    const delta = tls_versions.includes(1.2)
      ? [CURL.TLS_MAX, '1.3']
      : [CURL.TLSv1_3];
    command.push(
      ...delta,
      CURL.TLS13_CIPHERS,
      Array.isArray(ciphers_tls13) ? ciphers_tls13.join(':') : ciphers_tls13
    );
  }

  if (compress) {
    command.push(CURL.COMPRESSED);
  }

  if (options.proxy) {
    command.push(CURL.PROXY, formatProxyString(options.proxy));
  }

  if (options.follow !== undefined) {
    command.push(
      CURL.FOLLOW,
      CURL.MAX_REDIRS,
      typeof options.follow === 'number' ? String(options.follow) : '3'
    );
  }

  if (
    options.http?.version === 1.1 &&
    (options.http?.keepAlive !== undefined ||
      options.http?.keepAliveProbes !== undefined)
  ) {
    if (options.http.keepAlive === false || options.http.keepAlive === 0) {
      command.push(CURL.NO_KEEPALIVE);
    }
    if (typeof options.http.keepAlive === 'number') {
      command.push(CURL.KEEPALIVE_TIME, String(options.http.keepAlive));
    }
    if (typeof options.http.keepAliveProbes === 'number') {
      command.push(CURL.KEEPALIVE_CNT, String(options.http.keepAliveProbes));
    }
  }

  // Process the body once and determine finalBody.
  let finalBody: string | undefined;
  if (options.body) {
    if (typeof options.body === 'object') {
      // Convert any object (assuming it's plain) to JSON.
      finalBody = JSON.stringify(options.body);
    } else if (typeof options.body === 'string') {
      finalBody = options.body;
    }
    // Add body data to command.
    if (finalBody !== undefined) {
      command.push(CURL.DATA_RAW, finalBody);
    }
  }

  // Build headers.
  const headers: Headers = !options.headers
    ? new Headers()
    : options.headers instanceof Headers
      ? options.headers
      : new Headers(
          Object.entries(options.headers)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)] as [string, string])
        );

  // Set default user agent if there is none in headers and we have one initialized
  if (!headers.has('user-agent') && initialized.defaultAgent) {
    command.push(CURL.USER_AGENT, initialized.defaultAgent);
  }

  // Set content-type header if missing and if a body exists.
  if (!headers.has('content-type') && finalBody !== undefined) {
    headers.set('content-type', determineContentType(finalBody));
  }

  // Append headers to command.
  for (const [key, value] of headers as unknown as Iterable<[string, string]>) {
    command.push(CURL.HEADER, `${key}: ${value}`);
  }

  command.push(CURL.METHOD, options.method?.toUpperCase() || 'GET');

  // Properly encode [ and ] in the URL.
  command.push(url.replace(/\[/g, '%5B').replace(/\]/g, '%5D'));

  return command;
}
