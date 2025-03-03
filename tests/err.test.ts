import { expect, test } from 'bun:test';
import { fetch, ResponseWrapper } from '../src';

test('error', async () => {
  // Test: invalid host should reject with an error that has exitCode 6.
  expect(fetch('https://invalid_host.name.com')).rejects.toMatchObject({
    exitCode: 6,
    code: 'ERR_CURL_FAILED',
  });

  // Test: valid URL returns a ResponseWrapper instance.
  const successResponse = await fetch('https://www.example.com');

  expect(successResponse).toBeInstanceOf(ResponseWrapper);

  // Test: invalid proxy string should result in an error that has exitCode 5.
  expect(
    fetch('https://www.example.com', {
      proxy: 'test:123',
    })
  ).rejects.toMatchObject({
    exitCode: 5,
    code: 'ERR_CURL_FAILED',
  });
});
