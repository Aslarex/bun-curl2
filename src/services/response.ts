import type {
  GlobalInit,
  BaseResponseInit,
  RequestInit,
  ResponseInit,
} from '../types';
import Headers from '../models/headers';
import { hasJsonStructure } from '../models/utils';

function normalizeHeaders(
  h: string[][] | [string, string][],
): [string, string][] {
  const out: [string, string][] = new Array(h.length);
  for (let i = 0; i < h.length; i++) {
    const row = h[i];
    out[i] = [row[0] ?? '', row[1] ?? ''];
  }
  return out;
}

function getHeader(headers: [string, string][], name: string): string | null {
  const n = name.toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (headers[i][0].toLowerCase() === n) return headers[i][1];
  }
  return null;
}

function getContentType(headers: [string, string][]): string {
  for (let i = 0; i < headers.length; i++) {
    const k = headers[i][0];
    const c0 = k.charCodeAt(0) | 32;
    if (c0 === 99 && k.length === 12 && k === 'Content-Type')
      return headers[i][1];
    if (k.toLowerCase() === 'content-type') return headers[i][1];
  }
  return '';
}

function findHttpStarts(raw: string, out: number[]) {
  const n = raw.length;
  for (let i = 0; i < n - 5; i++) {
    if (
      raw.charCodeAt(i) === 72 &&
      raw.charCodeAt(i + 1) === 84 &&
      raw.charCodeAt(i + 2) === 84 &&
      raw.charCodeAt(i + 3) === 80 &&
      raw.charCodeAt(i + 4) === 47
    ) {
      const prev = i - 1;
      if (
        prev < 0 ||
        raw.charCodeAt(prev) === 10 ||
        (prev > 0 &&
          raw.charCodeAt(prev) === 13 &&
          raw.charCodeAt(prev - 1) === 10)
      ) {
        out.push(i);
      }
    }
  }
}

export class ResponseWrapper<T, U extends boolean>
  implements ResponseInit<T, U>
{
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
    public options: RequestInit<T, U>,
    public redirects: ResponseInit<T, U>['redirects'] = [],
  ) {}
  private _text?: string;
  private _json?: unknown;
  private _ab?: ArrayBuffer;
  private _blob?: Blob;
  json(): T {
    if (this.options.stream)
      throw new Error('Response is a stream. Consume it directly.');
    if (this._json !== undefined) return this._json as T;
    if (typeof this.response === 'string') {
      this._json = JSON.parse(this.response);
    } else {
      this._json = this.response;
    }
    return this._json as T;
  }
  text(): string {
    if (this.options.stream)
      throw new Error('Response is a stream. Consume it directly.');
    if (this._text !== undefined) return this._text;
    this._text =
      typeof this.response === 'string'
        ? this.response
        : JSON.stringify(this.response);
    return this._text;
  }
  arrayBuffer(): ArrayBuffer {
    if (this.options.stream)
      throw new Error('Response is a stream. Consume it directly.');
    if (this._ab) return this._ab;
    this._ab = Buffer.from(this.text(), 'binary').buffer;
    return this._ab;
  }
  blob(): Blob {
    if (this.options.stream)
      throw new Error('Response is a stream. Consume it directly.');
    if (this._blob) return this._blob;
    this._blob = new Blob([Buffer.from(this.text(), 'binary')]);
    return this._blob;
  }
}

export function processResponses(
  url: string,
  raw: string,
  startTime: number,
  parseJSON: boolean,
  cached: boolean,
): BaseResponseInit[] {
  const entries: BaseResponseInit[] = [];
  const rawLen = raw.length;
  const starts: number[] = [];
  findHttpStarts(raw, starts);
  if (starts.length === 0) return entries;
  starts.push(rawLen);
  for (let i = 0; i < starts.length - 1; i++) {
    const part = raw.substring(starts[i], starts[i + 1]).replace(/^\r?\n/, '');
    const rnrn = part.indexOf('\r\n\r\n');
    const nn = part.indexOf('\n\n');
    const hdrEnd = rnrn > -1 ? rnrn : nn > -1 ? nn : part.length;
    const sepLen = rnrn > -1 ? 4 : nn > -1 ? 2 : 0;
    const statusLineEnd = part.indexOf('\r\n', 0);
    const statusLine =
      statusLineEnd > -1
        ? part.substring(0, statusLineEnd)
        : part.substring(0, hdrEnd);
    const status = parseInt(statusLine.split(' ')[1], 10) || 500;
    const headers: [string, string][] = [];
    let cursor = statusLineEnd > -1 ? statusLineEnd + 2 : statusLine.length;
    while (cursor < hdrEnd) {
      const nextEnd = part.indexOf('\r\n', cursor);
      const endPos = nextEnd > -1 && nextEnd <= hdrEnd ? nextEnd : hdrEnd;
      const colon = part.indexOf(':', cursor);
      if (colon > cursor && colon < endPos) {
        headers.push([
          part.substring(cursor, colon),
          part.substring(colon + 1, endPos).trimStart(),
        ]);
      }
      cursor = endPos + 2;
    }
    const body = sepLen ? part.substring(hdrEnd + sepLen).trim() : '';
    entries.push({
      url,
      body,
      headers,
      status,
      requestStartTime: startTime,
      parseJSON,
      cached,
    });
  }
  return entries;
}

export function buildResponse<T, U extends boolean>(
  entry: BaseResponseInit,
  opts: RequestInit<T, U>,
  cfg: GlobalInit,
): ResponseInit<T, U> {
  if (cfg.maxBodySize) {
    const limit = cfg.maxBodySize * 1024 * 1024;
    if (entry.body.length > limit) {
      const err = new Error(
        `[BunCurl2] - Maximum body size exceeded (${(entry.body.length / limit).toFixed(2)} MiB)`,
      );
      Object.defineProperty(err, 'code', { value: 'ERR_BODY_SIZE_EXCEEDED' });
      throw err;
    }
  }
  const hdrPairs = normalizeHeaders(entry.headers);
  const ct = getContentType(hdrPairs);
  const lower = ct.toLowerCase();
  const isText =
    lower.startsWith('text/') ||
    lower.includes('json') ||
    lower.includes('xml') ||
    lower.includes('javascript');
  let data: T;
  if (isText) {
    const txt = Buffer.from(entry.body, 'binary').toString('utf-8');
    if (entry.parseJSON) {
      try {
        const parsed = JSON.parse(txt);
        data = hasJsonStructure(parsed) ? (parsed as T) : (txt as unknown as T);
      } catch {
        data = txt as unknown as T;
      }
    } else {
      data = txt as unknown as T;
    }
  } else {
    data = entry.body as unknown as T;
  }
  const status = entry.status;
  const ok = status >= 200 && status < 300;
  const redir = status >= 300 && status < 400;
  const type = status >= 400 ? 'error' : 'default';
  return new ResponseWrapper(
    entry.url,
    data,
    new Headers(hdrPairs),
    status,
    ok,
    redir,
    type,
    entry.cached,
    performance.now() - entry.requestStartTime,
    opts,
  );
}

export function processAndBuild<T, U extends boolean = false>(
  url: string,
  raw: string,
  startTime: number,
  parseJSON: boolean,
  cached: boolean,
  opts: RequestInit<T, U>,
  cfg: GlobalInit,
): ResponseInit<T, U> {
  const entries = processResponses(url, raw, startTime, parseJSON, cached);
  if (entries.length > 1) {
    const h0 = getHeader(normalizeHeaders(entries[0].headers), 'location');
    if (!h0) entries.shift();
  }
  if (cfg.redirectsAsUrls === true) {
    let cur = url;
    const urls: string[] = [];
    for (const entry of entries) {
      if (entry.status >= 300 && entry.status < 400) {
        const loc = getHeader(normalizeHeaders(entry.headers), 'location');
        if (loc) {
          cur = new URL(loc, cur).toString();
          urls.push(cur);
        }
      }
    }
    const lastEntry = entries[entries.length - 1];
    const final = buildResponse<T, U>(lastEntry, opts, cfg) as ResponseInit<
      T,
      U
    >;
    final.url = cur;
    final.redirected = urls.length > 0;
    final.redirects = urls as ResponseInit<T, U>['redirects'];
    return final;
  }
  const wrappers = entries.map((e) => buildResponse<T, U>(e, opts, cfg));
  wrappers[0].url = url;
  let cur = url;
  const lastIdx = wrappers.length - 1;
  for (let i = 0; i < lastIdx; i++) {
    const w = wrappers[i];
    if (w.status >= 300 && w.status < 400) {
      const loc = w.headers.get('location');
      if (loc) {
        cur = new URL(loc, cur).toString();
        wrappers[i + 1].url = cur;
      }
    }
  }
  const final = wrappers[lastIdx] as ResponseInit<T, U>;
  final.redirected = lastIdx > 0;
  final.redirects = wrappers.slice(0, lastIdx) as ResponseInit<
    T,
    U
  >['redirects'];
  return final;
}
