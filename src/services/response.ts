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
    public options: RequestInit<T>
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
  initialized: GlobalInit
): ResponseWrapper<T> {
  if (initialized.maxBodySize) {
    const MAX_BODY_SIZE = initialized.maxBodySize * 1024 * 1024;

    if (responseData.body.length > MAX_BODY_SIZE) {
      const maxBodySizeError = new Error(
        `[BunCurl2] - Maximum body size exceeded (${responseData.body.length / (1024 * 1024)})`
      );
      Object.defineProperty(maxBodySizeError, 'code', {
        value: 'ERR_BODY_SIZE_EXCEEDED',
      });
      throw maxBodySizeError;
    }
  }

  // Detect Content-Type to handle text vs non-text responses
  const contentTypeHeader = responseData.headers.find(
    ([key]) => key.toLowerCase() === 'content-type'
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
      res = JSON.parse(res as string);
      if (!hasJsonStructure(res as object))
        throw new Error('Invalid JSON Response');
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
    performance.now() - responseData.startTime,
    options
  );

  return response;
}

// Define the regex outside the function to reuse it across calls.
const headerRegex = /^(HTTP\/\d(?:\.\d)?\s+\d{3}.*?)(?:\r?\n){2}/gms;

function ProcessResponse(
  url: string,
  stdout: string,
  startTime: number,
  parse: boolean
): BaseResponseInit {
  // Reset the regex state to ensure correct matching on every call.
  headerRegex.lastIndex = 0;

  let lastMatch: RegExpExecArray | null = null;
  let currentMatch: RegExpExecArray | null;

  // Iterate using regex.exec to avoid allocating an array for all matches.
  while ((currentMatch = headerRegex.exec(stdout)) !== null) {
    lastMatch = currentMatch;
  }

  if (!lastMatch) {
    const invalidBodyError = new Error(
      `[BunCurl2] - Received unknown response (${stdout})`
    );
    Object.defineProperty(invalidBodyError, 'code', {
      value: 'ERR_INVALID_RESPONSE_BODY',
    });
    throw invalidBodyError;
  }

  // Retrieve the header block and compute its end index.
  const headerBlock = lastMatch[1];
  const headerEndIndex = (lastMatch.index || 0) + lastMatch[0].length;

  // Retrieve the body; trimming is kept but consider removing if whitespace is not an issue.
  const body = stdout.substring(headerEndIndex).trim();

  // Parse the status code from the header block.
  const statusMatch = headerBlock.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;

  // Split header block into lines and extract header key-value pairs.
  const headerLines = headerBlock.split(/\r?\n/);
  const headers: string[][] = [];

  // Start from index 1 to skip the status line.
  for (let i = 1; i < headerLines.length; i++) {
    const line = headerLines[i];
    const idx = line.indexOf(': ');
    if (idx !== -1) {
      const name = line.substring(0, idx);
      const value = line.substring(idx + 2);
      headers.push([name, value]);
    }
  }

  return {
    url,
    body,
    headers,
    status,
    parseJSON: parse,
    cached: false,
    startTime,
  };
}

export { ProcessResponse, BuildResponse, ResponseWrapper };
