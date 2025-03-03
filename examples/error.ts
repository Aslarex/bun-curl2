import { fetch } from '../src';

try {
  await fetch('https://invalid_hostname.com');
} catch (e) {
  console.error(e.message); // [BunCurl2] - Could not resolve host: invalid_hostname.com
  console.error(e.exitCode); // 6
}
