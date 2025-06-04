import BunCurl2 from '../src';
import { expect, test } from 'bun:test';

const Client = new BunCurl2({
  cache: {
    mode: 'local',
  },
});

test('cache', async () => {
  Client.connect();

  const ShouldNotCache = await Client.get('https://www.example.com', {
    cache: {
      validate: () => false,
    },
    parseJSON: false,
  });

  const ShouldNotCacheEither = await Client.get('https://www.example.com', {
    cache: {
      validate: async () => false,
    },
    parseJSON: false,
  });

  const CacheRequest = await Client.get('https://www.example.com', {
    cache: {
      validate: async () => true,
      expire: 1.5, // 1.5s -> 1500ms
    },
    parseJSON: false,
  });

  const ShouldReturnFromCache = await Client.get('https://www.example.com', {
    cache: true,
    parseJSON: false,
  });

  await Bun.sleep(1500);

  const ShouldBeExpired = await Client.get('https://www.example.com', {
    cache: true,
    parseJSON: false,
  });

  // required if we want the process to exit after finish
  await Client.destroy();

  expect(ShouldNotCache.cached).toBe(false);

  expect(ShouldNotCacheEither.cached).toBe(false);

  expect(CacheRequest.cached).toBe(false);

  expect(ShouldReturnFromCache.cached).toBe(true);

  expect(ShouldBeExpired.cached).toBe(false);
});
