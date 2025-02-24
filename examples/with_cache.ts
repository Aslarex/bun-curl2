import BunCurl from "../src";


const testWithCache = new BunCurl({
    cache: {
        options: {},
        defaultExpiration: 3 // 3 seconds
    }
});

await testWithCache.initializeCache();

const first_request = await testWithCache.get("https://www.example.com", { cache: true });

const second_request = await testWithCache.get("https://www.example.com", { cache: true });

console.log(`Did first request gave response from cache: ${first_request.cached}`);

console.log(`Did second request gave response from cache: ${second_request.cached}`);

process.exit();