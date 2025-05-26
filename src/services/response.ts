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
    // avoid typeof twice
    const resp = this.response;
    return (
      typeof resp === 'object' ? resp : JSON.parse(resp as unknown as string)
    ) as T;
  }

  /**
   * Returns the body as a string.
   */
  text(): string {
    const resp = this.response;
    return typeof resp === 'object'
      ? JSON.stringify(resp)
      : (resp as unknown as string);
  }

  /**
   * Returns the body as an ArrayBuffer.
   */
  arrayBuffer(): ArrayBuffer {
    // Buffer.from returns a Node Buffer (Uint8Array subclass)
    // its .buffer is a true ArrayBuffer
    const buf = Buffer.from(this.text(), 'binary').buffer as ArrayBuffer;
    return buf;
  }

  /**
   * Returns the body as a Blob.
   */
  blob(): Blob {
    // pass the Buffer (Uint8Array) directly as a BlobPart
    const bufView = Buffer.from(this.text(), 'binary');
    return new Blob([bufView]);
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
  // enforce max body size early
  if (initialized.maxBodySize) {
    const maxBytes = initialized.maxBodySize * 1024 * 1024;
    if (responseData.body.length > maxBytes) {
      const err = new Error(
        `[BunCurl2] - Maximum body size exceeded (${(
          responseData.body.length /
          (1024 * 1024)
        ).toFixed(2)} MiB)`,
      );
      Object.defineProperty(err, 'code', { value: 'ERR_BODY_SIZE_EXCEEDED' });
      throw err;
    }
  }

  // locate content-type header quickly
  let contentType = '';
  for (const [k, v] of responseData.headers) {
    if (
      k.charCodeAt(0) === 0x63 /* 'c' */ &&
      k.toLowerCase() === 'content-type'
    ) {
      contentType = v;
      break;
    }
  }
  const lowerCT = contentType.toLowerCase();

  // Determine if the response is text-based or binary
  const isTextResponse =
    lowerCT.startsWith('text/') ||
    lowerCT.includes('json') ||
    lowerCT.includes('xml') ||
    lowerCT.includes('javascript');

  // Parse text-based responses
  let res: T;
  if (isTextResponse) {
    // turn the raw binary string into a UTF-8 string via Buffer
    const rawUtf8 = Buffer.from(responseData.body, 'binary').toString('utf-8');
    if (responseData.parseJSON) {
      try {
        const parsed = JSON.parse(rawUtf8);
        if (hasJsonStructure(parsed)) {
          res = parsed as T;
        } else {
          res = rawUtf8 as unknown as T;
        }
      } catch {
        res = rawUtf8 as unknown as T;
      }
    } else {
      res = rawUtf8 as unknown as T;
    }
  } else {
    res = responseData.body as unknown as T;
  }

  const status = responseData.status;
  const ok = status >= 200 && status < 300;
  const redirected = status >= 300 && status < 400;
  const type = status >= 400 ? 'error' : 'default';

  return new ResponseWrapper<T>(
    responseData.url,
    res,
    new Headers(responseData.headers),
    status,
    ok,
    redirected,
    type,
    responseData.cached,
    performance.now() - responseData.requestStartTime,
    options,
  );
}

function ProcessResponse(
  url: string,
  stdout: string,
  requestStartTime: number,
  parseJSON: boolean,
  cached: boolean,
): BaseResponseInit {
  // find last "HTTP/" occurrence
  const headerStart = stdout.lastIndexOf('\nHTTP/');
  const startIdx =
    headerStart >= 0 ? headerStart + 1 : stdout.indexOf('HTTP/') >= 0 ? 0 : -1;
  if (startIdx === -1) {
    const err = new Error(`[BunCurl2] - Received unknown response (${stdout})`);
    Object.defineProperty(err, 'code', { value: 'ERR_INVALID_RESPONSE_BODY' });
    throw err;
  }

  // find header/body delimiter
  let headerEnd = stdout.indexOf('\r\n\r\n', startIdx);
  let delimLen = 4;
  if (headerEnd === -1) {
    headerEnd = stdout.indexOf('\n\n', startIdx);
    delimLen = 2;
  }
  if (headerEnd === -1) {
    const err = new Error(`[BunCurl2] - Received unknown response (${stdout})`);
    Object.defineProperty(err, 'code', { value: 'ERR_INVALID_RESPONSE_BODY' });
    throw err;
  }

  const headerBlock = stdout.slice(startIdx, headerEnd);
  const body = stdout.slice(headerEnd + delimLen).trim();

  // parse status line
  const [statusLine, ..._] = headerBlock.split(/\r?\n/, 2);
  const statusCode = parseInt(statusLine.split(' ')[1] || '', 10) || 500;

  // parse headers
  const headers: string[][] = [];
  for (const line of headerBlock.split(/\r?\n/).slice(1)) {
    const idx = line.indexOf(': ');
    if (idx > 0) {
      headers.push([line.slice(0, idx), line.slice(idx + 2)]);
    }
  }

  return {
    url,
    body,
    headers,
    status: statusCode,
    requestStartTime,
    parseJSON,
    cached,
  };
}

export { ProcessResponse, BuildResponse, ResponseWrapper };
