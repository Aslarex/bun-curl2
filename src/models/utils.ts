import * as crypto from 'crypto';

/**
 * Helper: Determine if string is a valid stringified JSON
 */
export function hasJsonStructure(str: string): boolean {
  if (typeof str !== 'string') return false;
  try {
    const result = JSON.parse(str);
    const type = Object.prototype.toString.call(result);
    return type === '[object Object]' || type === '[object Array]';
  } catch {
    return false;
  }
}


/**
 * Helper: Determine Content-Type based on body content.
 */
export function determineContentType(body: string): string {
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

export function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}
