import { fetch } from '../src';

const req = await fetch('https://www.example.com', {
  parseResponse: false,
});

console.log(req);
