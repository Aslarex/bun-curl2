import { fetch } from '../src';

try {
  await fetch('https://invalid_hostname.com');
} catch (e) {
  console.error(e.options); // Request options including request url
  console.error(e.message); // Error message
}
