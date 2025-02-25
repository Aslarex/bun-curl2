import BunCurl2 from '../src';
import { expect, test } from "bun:test";

const Client = new BunCurl2({
  cache: {},
});


test("cache validation", async () => {

  await Client.initializeCache();

  // Sleep for 1 second to make sure cache expired
  await Bun.sleep(1000);

  const ShouldNotCache = await Client.get('https://www.example.com', {
    cache: {
      validate: () => false,
    },
    parseResponse: false
  });
  
  const ShouldNotCacheEither = await Client.get('https://www.example.com', {
    cache: {
      validate: async () => new Promise<boolean>(resolve => resolve(false)),
    },
    parseResponse: false
  });

  const CacheRequest = await Client.get('https://www.example.com', {
    cache: {
      validate: async () => true,
      expire: 1
    },
    parseResponse: false
  });

  const ShouldReturnFromCache = await Client.get("https://www.example.com", {
    cache: true,
    parseResponse: false
  });

  await Client.disconnectCache();

  expect(ShouldNotCache.cached).toBe(false);

  expect(ShouldNotCacheEither.cached).toBe(false);

  expect(CacheRequest.cached).toBe(false);

  expect(ShouldReturnFromCache.cached).toBe(true);

});
