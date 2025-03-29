import * as crypto from 'crypto';
import { PROTOCOL_PORTS } from './constants';

/**
 * Helper: Determine if a string or object is a valid JSON structure (object or array).
 *
 * @param i - The string or object to test.
 * @returns {boolean} True if the input represents a JSON object or array, false otherwise.
 */
export function hasJsonStructure(i: string | object): boolean {
  let res: any;
  if (typeof i === 'string') {
    const str = i.trim();
    const firstChar = str[0];
    const lastChar = str[str.length - 1];
    // If the string doesn't start and end with matching JSON brackets, return false.
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
  // Check that the parsed value is either an object or an array.
  return (
    res !== null &&
    typeof res === 'object' &&
    (res.constructor === Object || Array.isArray(res))
  );
}

/**
 * Helper: Determine Content-Type based on body content.
 *
 * @param body - The body string.
 * @returns {string} The determined Content-Type.
 */
export function determineContentType(body: string): string {
  if (hasJsonStructure(body)) {
    return 'application/json';
  }

  // Fast pre-check: if no '=' exists, it's unlikely to be URL-encoded.
  if (body.indexOf('=') === -1) return 'text/plain';

  // Manually check that each ampersand-separated part contains an '='.
  const pairs = body.split('&');
  for (let i = 0, len = pairs.length; i < len; i++) {
    // If any pair does not include '=', it's not properly URL-encoded.
    if (pairs[i].indexOf('=') === -1) return 'text/plain';
  }
  return 'application/x-www-form-urlencoded';
}

export function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Helper: extract final URL from the output using a custom marker.
export function extractFinalUrl(output: string): {
  finalUrl: string | null;
  body: string;
} {
  const marker = '\nFinal-Url:';
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex === -1) {
    return { finalUrl: null, body: output };
  }
  const finalUrl = output.slice(markerIndex + marker.length).trim();
  const body = output.slice(0, markerIndex);
  return { finalUrl, body };
}

export function getDefaultPort(protocol: string): number | undefined {
  return PROTOCOL_PORTS[
    protocol.toLowerCase().replaceAll(':', '').replaceAll('/', '')
  ];
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

export function compareVersions(v1: string, v2: string): number {
  let i = 0,
    j = 0;
  const len1 = v1.length,
    len2 = v2.length;

  while (i < len1 || j < len2) {
    let num1 = 0,
      num2 = 0;

    // Parse next number in v1
    while (i < len1 && v1.charAt(i) !== '.') {
      // Assuming version strings are valid digits
      num1 = num1 * 10 + (v1.charCodeAt(i) - 48);
      i++;
    }

    // Parse next number in v2
    while (j < len2 && v2.charAt(j) !== '.') {
      num2 = num2 * 10 + (v2.charCodeAt(j) - 48);
      j++;
    }

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;

    // Skip the '.' character
    i++;
    j++;
  }

  return 0;
}
