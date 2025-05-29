import type {
  GlobalInit,
  BaseResponseInit,
  RequestInit,
  ResponseInit,
} from '../types';
import Headers from '../models/headers';
import { hasJsonStructure } from '../models/utils';

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

  json(): T {
    return typeof this.response === 'string'
      ? JSON.parse(this.response)
      : this.response;
  }

  text(): string {
    return typeof this.response === 'string'
      ? this.response
      : JSON.stringify(this.response);
  }

  arrayBuffer(): ArrayBuffer {
    return Buffer.from(this.text(), 'binary').buffer;
  }

  blob(): Blob {
    return new Blob([Buffer.from(this.text(), 'binary')]);
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

  let pos = 0;
  while (true) {
    const idx = raw.indexOf('HTTP/', pos);
    if (idx === -1) break;
    if (
      idx === 0 ||
      raw[idx - 1] === '\n' ||
      (idx > 1 && raw[idx - 1] === '\r' && raw[idx - 2] === '\n')
    ) {
      starts.push(idx);
    }
    pos = idx + 5;
  }
  if (starts.length === 0) return entries;
  starts.push(rawLen);

  for (let i = 0; i < starts.length - 1; i++) {
    const part = raw.substring(starts[i], starts[i + 1]).replace(/^\r?\n/, '');
    const rnrn = part.indexOf('\r\n\r\n');
    const nn = part.indexOf('\n\n');
    let hdrEnd = rnrn > -1 ? rnrn : nn > -1 ? nn : part.length;
    let sepLen = rnrn > -1 ? 4 : nn > -1 ? 2 : 0;

    const headerBlock = part.substring(0, hdrEnd);
    const body = sepLen ? part.substring(hdrEnd + sepLen).trim() : '';

    const lineEnd = headerBlock.indexOf('\r\n');
    const statusLine =
      lineEnd > -1 ? headerBlock.substring(0, lineEnd) : headerBlock;
    const status = parseInt(statusLine.split(' ')[1], 10) || 500;

    const hdrs: string[][] = [];
    let cursor = lineEnd > -1 ? lineEnd + 2 : statusLine.length;
    while (cursor < headerBlock.length) {
      const nextEnd = headerBlock.indexOf('\r\n', cursor);
      const endPos = nextEnd > -1 ? nextEnd : headerBlock.length;
      const colon = headerBlock.indexOf(': ', cursor);
      if (colon > cursor && colon < endPos) {
        hdrs.push([
          headerBlock.substring(cursor, colon),
          headerBlock.substring(colon + 2, endPos),
        ]);
      }
      cursor = endPos + 2;
    }

    entries.push({
      url,
      body,
      headers: hdrs,
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
        `[BunCurl2] - Maximum body size exceeded (${(
          entry.body.length / limit
        ).toFixed(2)} MiB)`,
      );
      Object.defineProperty(err, 'code', { value: 'ERR_BODY_SIZE_EXCEEDED' });
      throw err;
    }
  }

  let ct = '';
  for (const [k, v] of entry.headers) {
    if (k.charCodeAt(0) === 99 && k.toLowerCase() === 'content-type') {
      ct = v;
      break;
    }
  }
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
    new Headers(entry.headers),
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
    const firstHdrs = new Headers(entries[0].headers);
    if (!firstHdrs.has('location')) {
      entries.shift();
    }
  }

  if (cfg.redirectsAsUrls === true) {
    let cur = url;
    const urls: string[] = [];

    for (const entry of entries) {
      if (entry.status >= 300 && entry.status < 400) {
        const loc = new Headers(entry.headers).get('location');
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
