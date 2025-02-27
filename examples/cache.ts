import BunCurl2 from '../src';

const testWithCache = new BunCurl2({
  cache: {
    defaultExpiration: 3, // 3 seconds
    mode: "local" // local in memory caching via map
  },
});

await testWithCache.initializeCache();

// this one must be false unless mode is redis and cache entry already exists

const first_request = await testWithCache.get('https://www.example.com', {
  cache: true,
});

await Bun.sleep(2000);

// this one must be true

const second_request = await testWithCache.get('https://www.example.com', {
  cache: true,
});

await Bun.sleep(1000);

// this one must be false

const third_request = await testWithCache.get('https://www.example.com', {
  cache: true,
});

// always disconnect if you want to exit the process after finishing it
// otherwise you can keep on process alive as it uses interval
// for local cache mode and redis is a socket connection therefore
// it will stay alive
await testWithCache.disconnectCache();

console.log('Cache Tests', {
  firstRequest: first_request.cached,
  secondRequest: second_request.cached,
  thirdRequest: third_request.cached,
});
