/**
 * Example: Using Cache with bun-curl2
 *
 * This example demonstrates how to configure and use caching with BunCurl2.
 * It sets up local in-memory caching (via a Map) with a 3-second expiration.
 * The example then shows how cached responses are handled across multiple requests.
 *
 */

import BunCurl2 from '../src';

// Initialize BunCurl2 with caching enabled.
// Here, caching mode is set to 'local' (in-memory via Map) with a default expiration of 3 seconds.
const testWithCache = new BunCurl2({
  cache: {
    defaultExpiration: 3, // Cache entries expire in 3 seconds.
    mode: 'local', // Local caching using in-memory storage.
  },
});

// Connect to initialize cache-related resources.
// await is not needed since the mode we are using here is "local" but for "redis" it is required to await.
testWithCache.connect();

// ─── First Request ─────────────────────────────────────────────
// This request should not be cached (since it's the first one).
const firstRequest = await testWithCache.get('https://www.example.com', {
  cache: true,
});

// Wait 2 seconds before the next request.
await Bun.sleep(2000);

// ─── Second Request ─────────────────────────────────────────────
// This request should return a cached response (cached flag should be true).
const secondRequest = await testWithCache.get('https://www.example.com', {
  cache: true,
});

// Wait an additional 1 second (total 3 seconds since first request).
await Bun.sleep(1000);

// ─── Third Request ─────────────────────────────────────────────
// At this point, the cache entry should have expired (3-second expiration),
// so this request should not return a cached response.
const thirdRequest = await testWithCache.get('https://www.example.com', {
  cache: true,
});

// Always disconnect when finished to allow the process to exit.
// For local cache, a timer may keep the process alive; for Redis caching, the socket remains open.
await testWithCache.disconnect();

// Log the caching results.
console.log('Cache Tests', {
  firstRequest: firstRequest.cached, // Expected: false
  secondRequest: secondRequest.cached, // Expected: true
  thirdRequest: thirdRequest.cached, // Expected: false
});
