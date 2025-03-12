import { expect, test } from 'bun:test';
import BunCurl2 from '../src';

test('image response', async () => {
  const client = new BunCurl2();

  const imageRequest = await client.get(
    'https://cdn.discordapp.com/embed/avatars/1.png?size=128'
  );

  const blob = imageRequest.blob();

  expect(blob).toBeInstanceOf(Blob);

  expect(blob.size).toBeGreaterThan(1000);

  expect(imageRequest.json).toThrowError();
});
