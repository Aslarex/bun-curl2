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
  let idx = 0;

  while (true) {
    const pos = raw.indexOf('HTTP/', idx);
    if (pos < 0) break;
    const nextPos = raw.indexOf('\nHTTP/', pos + 1);
    const part = nextPos > 0 ? raw.slice(pos, nextPos) : raw.slice(pos);
    idx = nextPos > 0 ? nextPos : raw.length;

    let sep = part.indexOf('\r\n\r\n');
    let sepLen = 4;
    if (sep < 0) {
      sep = part.indexOf('\n\n');
      sepLen = 2;
    }

    const headerBlock = sep >= 0 ? part.slice(0, sep) : part;
    const body = sep >= 0 ? part.slice(sep + sepLen).trim() : '';

    const lines = headerBlock.split(/\r?\n/);
    const status = parseInt(lines[0].split(' ')[1]) || 500;

    const hdrs: string[][] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const j = line.indexOf(': ');
      if (j > 0) hdrs.push([line.slice(0, j), line.slice(j + 2)]);
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
