import type {
  GlobalInit,
  BaseResponseInit,
  RequestInit,
} from '../@types/Options';
import Headers from '../models/headers';

class ResponseWrapper<T> {
  #parsedJson: T | null = null;

  constructor(
    public url: string,
    public body: string,
    public headers: Headers,
    public status: number,
    public ok: boolean,
    public elapsedTime: number,
    public response: T,
    public redirected: boolean,
    public type: string,
    public cached: boolean,
    public options: RequestInit<T>
  ) {}

  /**
   * Returns the body as a parsed JSON object.
   */
  json(): T {
    if (this.#parsedJson) return this.#parsedJson;
    this.#parsedJson = JSON.parse(this.body) as T;
    return this.#parsedJson;
  }

  /**
   * Returns the body as a string.
   */
  text(): string {
    return this.body;
  }

  /**
   * Returns the body as an ArrayBuffer.
   */
  arrayBuffer(): ArrayBuffer {
    return Buffer.from(this.body, 'binary').buffer as ArrayBuffer;
  }

  /**
   * Returns the body as a Blob.
   */
  blob(): Blob {
    return new Blob([Buffer.from(this.body, 'binary')]);
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
  if (isTextResponse && responseData.parseResponse) {
    try {
      res = JSON.parse(res as string);
    } catch {
      // If parsing fails, retain the body as-is
    }
  }

  // Return the wrapped response
  const response = new ResponseWrapper<T>(
    responseData.url,
    responseData.body,
    new Headers(responseData.headers),
    responseData.status,
    responseData.ok,
    performance.now() - responseData.startTime,
    res,
    String(responseData.status).startsWith('3'),
    ['4', '5'].includes(String(responseData.status)[0]) ? 'error' : 'default',
    responseData.cached,
    options
  );

  return response;
}

function ProcessResponse(
  url: string,
  stdout: string,
  startTime: number,
  parse: boolean
): BaseResponseInit {
  // Use a regex to match header blocks that start at the beginning of a line.
  // The regex looks for a line beginning with "HTTP/<version> <status>"
  // followed by any characters (including newlines) until a double newline (the header/body separator).
  // The 'm' flag makes ^ match the beginning of a line,
  // and the 's' flag makes the dot match newlines.
  const headerRegex = /^(HTTP\/\d(?:\.\d)?\s+\d{3}.*?)(?:\r?\n){2}/gms;

  // Find all header blocks.
  const matches = [...stdout.matchAll(headerRegex)];

  if (matches.length === 0) {
    const invalidBodyError = new Error(`[BunCurl2] - Received unknown response (${stdout})`);
    Object.defineProperty(invalidBodyError, 'code', {
      value: 'ERR_INVALID_RESPONSE_BODY',
    });
    throw invalidBodyError;
  }

  // Select the last header block (the final response headers).
  const lastMatch = matches[matches.length - 1];
  // match[1] holds the header block (without the trailing blank line).
  const headerBlock = lastMatch[1];
  // Calculate where the header block ends in the original text.
  const headerEndIndex = (lastMatch.index || 0) + lastMatch[0].length;

  // The body is everything after the header block.
  const body = stdout.substring(headerEndIndex).trim();

  // Parse the status code from the header block.
  const statusMatch = headerBlock.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;

  // Now split the header block into individual lines.
  // (Here it’s safe to split the header block only, not the whole response.)
  const headerLines = headerBlock.split(/\r?\n/);
  // The first line is the status line, so skip it.
  const headers: string[][] = [];

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
    ok: status >= 200 && status < 300,
    parseResponse: parse,
    cached: false,
    startTime,
  };
}

export { ProcessResponse, BuildResponse, ResponseWrapper };
