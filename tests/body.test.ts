import { expect, test } from 'bun:test';
import { fetch } from '../src';

test('body', async () => {
  const formData = new FormData();
  // Create a Blob to simulate a file.
  const fileContent = 'Hello, world!';
  const blob = new Blob([fileContent], { type: 'text/plain' });
  formData.append('test_file', blob, 'hello.txt');

  const test_formData = await fetch<{ files: Record<'test_file', [string]> }>(
    'https://httpbingo.org/anything',
    {
      body: formData,
    },
  );

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('Hello, '));
      controller.enqueue(new TextEncoder().encode('world!'));
      controller.close();
    },
  });

  const test_stream = await fetch<{ data: string }>(
    'https://httpbingo.org/anything',
    {
      method: 'POST',
      body: stream,
      headers: {
        'content-type': 'text/plain;charset=utf-8',
      },
    },
  );

  const params = new URLSearchParams({ foo: 'bar', baz: 'qux' });

  const test_params = await fetch<{ form: Record<string, any> }>(
    'https://httpbingo.org/anything',
    {
      method: 'POST',
      body: params,
    },
  );

  expect(JSON.stringify(test_params.response.form)).toBe(
    JSON.stringify({ baz: ['qux'], foo: ['bar'] }),
  );

  expect(test_stream.response.data).toBe('Hello, world!');

  expect(test_formData.response.files.test_file).toMatchObject([fileContent]);
});
