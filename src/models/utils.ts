import * as crypto from 'crypto';

/** Determine if a string or object is a valid JSON structure (object or array). */
export function hasJsonStructure(i: string | object): boolean {
  let res: any;
  if (typeof i === 'string') {
    const str = i.trim();
    const firstChar = str[0];
    const lastChar = str[str.length - 1];
    if (
      (firstChar !== '{' || lastChar !== '}') &&
      (firstChar !== '[' || lastChar !== ']')
    ) {
      return false;
    }
    try {
      res = JSON.parse(str);
    } catch {
      return false;
    }
  } else {
    res = i;
  }
  return (
    res !== null &&
    typeof res === 'object' &&
    (res.constructor === Object || Array.isArray(res))
  );
}

/** Determine Content-Type based on body content. */
export function determineContentType(body: string): string {
  if (hasJsonStructure(body)) {
    return 'application/json';
  }

  if (body.indexOf('=') === -1) return 'text/plain';

  const pairs = body.split('&');
  for (let i = 0, len = pairs.length; i < len; i++) {
    if (pairs[i].indexOf('=') === -1) return 'text/plain';
  }
  return 'application/x-www-form-urlencoded';
}

export function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

export function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  for (const part of parts) {
    const len = part.length;
    if (len === 0 || len > 3) return false;

    if (len > 1 && part[0] === '0') return false;

    let num = 0;
    for (let i = 0; i < len; i++) {
      const code = part.charCodeAt(i);
      if (code < 48 || code > 57) return false;
      num = num * 10 + (code - 48);
    }
    if (num > 255) return false;
  }
  return true;
}

export function containsAlphabet(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      return true;
    }
  }
  return false;
}
/**
 * Compare two version strings (e.g. "1.2.3" vs "1.4"):
 * - returns 1 if v1 > v2
 * - returns -1 if v1 < v2
 * - returns 0 if they’re equal
 */
export function compareVersions(v1: string, v2: string): number {
  let i = 0,
    j = 0;
  const len1 = v1.length,
    len2 = v2.length;

  while (i < len1 || j < len2) {
    let num1 = 0,
      num2 = 0;

    while (i < len1 && v1.charAt(i) !== '.') {
      num1 = num1 * 10 + (v1.charCodeAt(i) - 48);
      i++;
    }

    while (j < len2 && v2.charAt(j) !== '.') {
      num2 = num2 * 10 + (v2.charCodeAt(j) - 48);
      j++;
    }

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;

    i++;
    j++;
  }

  return 0;
}
