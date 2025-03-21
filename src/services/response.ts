import type { GlobalInit, BaseResponseInit, RequestInit } from '../types';
import Headers from '../models/headers';
import { hasJsonStructure } from '../models/utils';

class ResponseWrapper<T> {
  constructor(
    public url: string,
    public response: T,
    public headers: Headers,
    public status: number,
    public ok: boolean,
    public redirected: boolean,
    public type: string,
    public cached: boolean,
    public elapsedTime: number,
    public options: RequestInit<T>,
  ) {}

  /**
   * Returns the body as a parsed JSON object.
   */
  json(): T {
    return typeof this.response === 'object'
      ? this.response
      : JSON.parse(this.response as string);
  }

  /**
   * Returns the body as a string.
   */
  text(): string {
    return typeof this.response === 'object'
      ? JSON.stringify(this.response)
      : (this.response as string);
  }

  /**
   * Returns the body as an ArrayBuffer.
   */
  arrayBuffer(): ArrayBuffer {
    return Buffer.from(this.text(), 'binary').buffer as ArrayBuffer;
  }

  /**
   * Returns the body as a Blob.
   */
  blob(): Blob {
    return new Blob([Buffer.from(this.text(), 'binary')]);
  }
}

/**
 * Build the response object
 */
function BuildResponse<T>(
  responseData: BaseResponseInit,
  options: RequestInit<T>,
  initialized: GlobalInit,
): ResponseWrapper<T> {
  if (initialized.maxBodySize) {
    const MAX_BODY_SIZE = initialized.maxBodySize * 1024 * 1024;

    if (responseData.body.length > MAX_BODY_SIZE) {
      const maxBodySizeError = new Error(
        `[BunCurl2] - Maximum body size exceeded (${responseData.body.length / (1024 * 1024)})`,
      );
      Object.defineProperty(maxBodySizeError, 'code', {
        value: 'ERR_BODY_SIZE_EXCEEDED',
      });
      throw maxBodySizeError;
    }
  }

  // Detect Content-Type to handle text vs non-text responses
  const contentTypeHeader = responseData.headers.find(
    ([key]) => key.toLowerCase() === 'content-type',
  );
  const contentType = contentTypeHeader ? contentTypeHeader[1] : '';

  // Determine if the response is text-based or binary
  const isTextResponse =
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript');

  // Parse text-based responses
  let res: T = isTextResponse
    ? (Buffer.from(responseData.body, 'binary').toString('utf-8') as T)
    : (responseData.body as unknown as T);

  // Parse JSON if applicable
  if (isTextResponse && responseData.parseJSON) {
    try {
      let i = JSON.parse(res as string);
      if (hasJsonStructure(i)) {
        res = i;
      }
      i = null!;
    } catch {
      // If parsing fails, retain the body as-is
    }
  }

  const redirected = responseData.status >= 300 && responseData.status < 400;
  const type = responseData.status >= 400 ? 'error' : 'default';
  const ok = responseData.status >= 200 && responseData.status < 300;

  // Return the wrapped response
  const response = new ResponseWrapper<T>(
    responseData.url,
    res,
    new Headers(responseData.headers),
    responseData.status,
    ok,
    redirected,
    type,
    responseData.cached,
    performance.now() - responseData.requestStartTime,
    options,
  );

  return response;
}

function ProcessResponse(
  url: string,
  stdout: string,
  requestStartTime: number,
  parseJSON: boolean,
  cached: boolean,
): BaseResponseInit {
  const len = stdout.length;
  let headerStartIndex = -1;
  // Scan backward for a newline followed by "HTTP/" to locate the final header block.
  for (let i = len - 6; i >= 0; i--) {
    // Check for "\nHTTP/" (or if at the very beginning, "HTTP/" at position 0)
    if (
      (i === 0 && stdout.startsWith('HTTP/')) ||
      (stdout.charAt(i) === '\n' && stdout.substring(i + 1, 5) === 'HTTP/')
    ) {
      headerStartIndex = i === 0 ? 0 : i + 1;
      break;
    }
  }
  if (headerStartIndex === -1) {
    // Fallback to lastIndexOf if backward scan failed.
    headerStartIndex = stdout.lastIndexOf('HTTP/');
    if (headerStartIndex === -1) {
      const invalidBodyError = new Error(
        `[BunCurl2] - Received unknown response (${stdout})`,
      );
      Object.defineProperty(invalidBodyError, 'code', {
        value: 'ERR_INVALID_RESPONSE_BODY',
      });
      throw invalidBodyError;
    }
  }

  // Now search for the header/body delimiter starting at headerStartIndex.
  let headerEndIndex = stdout.indexOf('\r\n\r\n', headerStartIndex);
  let delimiterLength = 4;
  if (headerEndIndex === -1) {
    headerEndIndex = stdout.indexOf('\n\n', headerStartIndex);
    delimiterLength = 2;
  }
  if (headerEndIndex === -1) {
    const invalidBodyError = new Error(
      `[BunCurl2] - Received unknown response (${stdout})`,
    );
    Object.defineProperty(invalidBodyError, 'code', {
      value: 'ERR_INVALID_RESPONSE_BODY',
    });
    throw invalidBodyError;
  }

  // Extract the header block and body.
  const headerBlock = stdout.substring(headerStartIndex, headerEndIndex);
  const body = stdout.substring(headerEndIndex + delimiterLength).trim();

  // Process the status line.
  let firstLineEnd = headerBlock.indexOf('\r\n');
  if (firstLineEnd === -1) firstLineEnd = headerBlock.indexOf('\n');
  if (firstLineEnd === -1) firstLineEnd = headerBlock.length;
  const statusLine = headerBlock.substring(0, firstLineEnd);
  let status = 500;
  const firstSpace = statusLine.indexOf(' ');
  if (firstSpace !== -1) {
    const secondSpace = statusLine.indexOf(' ', firstSpace + 1);
    const codeStr =
      secondSpace !== -1
        ? statusLine.substring(firstSpace + 1, secondSpace)
        : statusLine.substring(firstSpace + 1);
    status = parseInt(codeStr, 10) || 500;
  }

  // Manually scan for header lines after the status line.
  const headers: string[][] = [];
  let pos = firstLineEnd;
  // Determine the newline length (CRLF or LF) based on the first line break.
  let newlineLen = headerBlock.charAt(pos) === '\r' ? 2 : 1;
  pos += newlineLen; // Skip the status line.

  while (pos < headerBlock.length) {
    let nextPos = pos;
    while (nextPos < headerBlock.length) {
      const ch = headerBlock.charAt(nextPos);
      if (ch === '\r' || ch === '\n') break;
      nextPos++;
    }
    const line = headerBlock.substring(pos, nextPos);
    const colonIndex = line.indexOf(': ');
    if (colonIndex !== -1) {
      headers.push([
        line.substring(0, colonIndex),
        line.substring(colonIndex + 2),
      ]);
    }
    // Advance pos: handle both CRLF and LF.
    if (nextPos < headerBlock.length) {
      if (
        headerBlock.charAt(nextPos) === '\r' &&
        headerBlock.charAt(nextPos + 1) === '\n'
      ) {
        pos = nextPos + 2;
      } else {
        pos = nextPos + 1;
      }
    } else {
      break;
    }
  }

  return {
    url,
    body,
    headers,
    status,
    requestStartTime,
    parseJSON,
    cached,
  };
}

export { ProcessResponse, BuildResponse, ResponseWrapper };
