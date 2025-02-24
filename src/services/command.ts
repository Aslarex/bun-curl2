import type { Initialize, RequestInit } from '../@types/Options';
import Ciphers from '../models/ciphers';
import formatProxyString from '../models/proxy';
import { hasJsonStructure } from '../models/utils';

const httpVersionList = {
  3.0: '--http3',
  2.0: '--http2',
  1.1: '--http1.1',
};

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
    options = options.transformRequest(options);
  } else if (initialized.transfomRequest) {
    options = initialized.transfomRequest(options);
  }

  // Set default values.
  const maxTime = options.maxTime ?? 10;
  const connectionTimeout = options.connectionTimeout ?? 5;
  const compress = initialized.compress ?? true;
  const ciphers_tls12 = options.tls?.ciphers?.TLS12 ?? Ciphers['TLS12'];
  const ciphers_tls13 = options.tls?.ciphers?.TLS13 ?? Ciphers['TLS13'];
  const tls_versions = options.tls?.versions ?? [1.3, 1.2];
  const httpVersion = options.proxy ? 2.0 : (options.http?.version ?? 2.0);

  // Build the base curl command.
  const command: string[] = [
    'curl',
    '-i',
    '-m',
    String(maxTime),
    '--connect-timeout',
    String(connectionTimeout),
    httpVersionList[httpVersion],
  ];

  if (tls_versions.includes(1.2)) {
    command.push(
      '--tlsv1.2',
      '--ciphers',
      Array.isArray(ciphers_tls12) ? ciphers_tls12.join(':') : ciphers_tls12
    );
  }

  if (tls_versions.includes(1.3)) {
    const delta = tls_versions.includes(1.2)
      ? ['--tls-max', '1.3']
      : ['--tlsv1.3'];
    command.push(
      ...delta,
      '--tls13-ciphers',
      Array.isArray(ciphers_tls13) ? ciphers_tls13.join(':') : ciphers_tls13
    );
  }

  if (compress) {
    command.push('--compressed');
  }

  if (options.proxy) {
    command.push('--proxy', formatProxyString(options.proxy));
  }

  if (options.follow !== undefined) {
    command.push(
      '--follow',
      '--max-redirs',
      typeof options.follow === 'number' ? String(options.follow) : '3'
    );
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
      command.push('--data-raw', finalBody);
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
    command.push('-A', initialized.defaultAgent);
  }

  // Set content-type header if missing and if a body exists.
  if (!headers.has('content-type') && finalBody !== undefined) {
    headers.set('content-type', determineContentType(finalBody));
  }

  // Append headers to command.
  for (const [key, value] of headers as unknown as Iterable<[string, string]>) {
    command.push('-H', `${key}: ${value}`);
  }

  command.push('-X', options.method?.toUpperCase() || 'GET');

  // Properly encode [ and ] in the URL.
  command.push(url.replace(/\[/g, '%5B').replace(/\]/g, '%5D'));

  return command;
}
