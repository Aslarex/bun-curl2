import * as crypto from 'crypto';

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

export function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}
