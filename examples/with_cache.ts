import BunCurl from "../src";


const testWithCache = new BunCurl({
    cache: {
        defaultExpiration: 3 // 3 seconds
    }
});

await testWithCache.initializeCache();

const first_request = await testWithCache.get("https://www.example.com", { cache: true });

await Bun.sleep(2000);

const second_request = await testWithCache.get("https://www.example.com", { cache: true });

await Bun.sleep(1500);

const third_request = await testWithCache.get("https://www.example.com", { cache: true });

await testWithCache.disconnectCache();

console.log("Cache Tests", {
    firstRequest: first_request.cached,
    secondRequest: second_request.cached,
    thirdRequest: third_request.cached
});