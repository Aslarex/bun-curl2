import BunCurl2, { RequestInit } from '../src';
import { expect, test } from 'bun:test';

const TEST_URL = 'https://httpbin.org/delay/1';

test('concurrent requests (5)', () => {
  const client = new BunCurl2({ maxConcurrentRequests: 5 });

  const inFlight: Promise<RequestInit>[] = [];
  for (let i = 0; i < 5; i++) {
    inFlight.push(client.get(TEST_URL));
  }

  expect(client.get(TEST_URL)).rejects.toMatchObject({
    code: 'ERR_CONCURRENT_REQUESTS_REACHED',
  });

  Promise.allSettled(inFlight);
});
