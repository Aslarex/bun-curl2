import * as crypto from 'crypto';

/**
 * Helper: Determine if string or object is a valid JSON
 */
export function hasJsonStructure(i: string | object): boolean {
  try {
    const result = typeof i === 'string' ? JSON.parse(i) : i;
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
