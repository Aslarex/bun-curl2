# Changelog

> **Note:** Dates are formatted as `yyyy-mm-dd`.

## [0.0.33] - 2025-05-29 

> ⚠️ **WARNING:** Before upgrading, **clear your Redis cache** — any previously cached requests may not be parsed correctly.

- **Redis support**  
  Now compatible with Bun’s native Redis client. To continue using the npm-based implementation, enable `GlobalInit.cache.useRedisPackage` or configure your own cache server.

- **Performance improvements**
  Although less noticeable for small responses, difference is major for larger ones.

- **New**: `RequestInit.sortHeaders`  
  Control header ordering prior to dispatch.

- **Fix**: Typo in `transformRequest` (previously `transfomRequest`)

- **New**: `ResponseInit.redirects`  
  Collects redirect entries as full response objects by default. To receive URLs only, set the `redirectsAsUrls` client option.

- **Improved** response handler for more reliable parsing.

- **Fix**: Corrected `ResponseInit.redirected` flag logic so it now reflects actual redirects.

- **New**: `GlobalInit.maxConcurrentRequests`  
  Limit simultaneous requests to prevent overload.

- **Fix**: Corrected typos in JSDoc comments.

## [0.0.32] - 2025-03-29

- Request headers are now ordered, accept array pairs, and respect key casing if it’s not a `Headers` instance.
- Local DNS caching is now disabled by default because most cURL builds already offer DNS caching.
- Fixed the `RequestInit.dns.resolve` logic.
- Response headers are now instances of `Headers` instead of `URLSearchParams`.
- TLS versions must now be provided in their numeric formats in `RequestInit.tls.versions`; use the exported `TLS` variable for simplicity.
- Added TLS 1.0 and TLS 1.1 support; however, the default versions remain the same (TLS 1.2, TLS 1.3).
- Fixed the **HEAD** request method.
- Renamed `RequestInit.tls.ciphers.TLS12` to `RequestInit.tls.ciphers.DEFAULT`.
- **Google**'s servers are no longer used by default for DNS lookups.

## [0.0.31] - 2025-03-12

- Optimizations to response manipulation and command builder ⚡.
- Introduced the `RequestInit.tls.insecure` property ⭐.
- Added JSDoc comments for the **BunCurl2** instance 💭.

## [0.0.27] & [0.0.28] - 2025-03-08

- Fixed TypeScript issues (sorry about that).
- Added DNS caching support locally (max 255 entries), configurable via the `RequestInit.dns` property.
- Added TCP FastOpen and TCP NoDelay support, configurable via the `GlobalInit.tcp` property.
- Improved cache key generation logic and added a `generate` function in the `RequestInit.cache` property for manually generating the cache key.
- Fixed the issue where the `RequestInit.follow` property was not set to `true` by default.
- HTTP version no longer defaults to 3.0 if the cURL build supports it.

## [0.0.25] & [0.0.26] - 2025-03-06

- Reduced build size by **~50%**.
- Minor optimizations: full requests now take **~5%** less time and consume less memory.
- Renamed `parseResponse` to `parseJSON`.
- You can now disable response compression per request by providing `compress: false` in the request options.
- Added the `dns` request property.

## [0.0.24] - 2025-03-05

- A mini update that should fix issues regarding HTTP versions and TLS ciphers in some cURL builds.

## [0.0.23] - 2025-03-03

- Improved error handling [[EXAMPLE]](./examples/error.ts).
- If the `follow` property is **true**, the request will follow redirects up to 10 times.
- The `ResponseWrapper.url` now reflects the final destination URL even after redirects.

## [0.0.21] & [0.0.22] - 2025-02-28

- Added a `local` cache mode! However, Redis remains the default. [[EXAMPLE]](./examples/cache.ts).
- The `body` property now supports all the types that **fetch** has implemented (EXPERIMENTAL).
- Added additional TypeScript fixes.

## [0.0.20] - 2025-02-26

- **⚠️ IMPORTANT:** Fixed an incorrect argument name passed when the `follow` property was provided (`--follow` **->** `--location`).
- Fixed JSDoc comments being removed.

## [0.0.19] - 2025-02-25

- Added cache validation support via a function, which can be either asynchronous or synchronous.
- Added global `parseResponse` support in the `BunCurl2` options.
- `transformResponse` now accepts promise responses.

## [0.0.18] - 2025-02-25

- Added transformResponse support.
- Types are now exported.
- Made it possible to provide `transformRequest: false` in options to disable the global transformation provided by `BunCurl2` for that specific request.

## [0.0.17] - 2025-02-25

- Added backwards compatibility in `package.json`.

## [0.0.16] - 2025-02-25

- Added AbortController signal support. [[EXAMPLE]](./examples/abort.ts)
- Fixed Redis logic and TTL issues.
- Fixed response type propagation in `BunCurl2` methods.
- Added the `BunCurl2.disconnectCache` method.
- Fixed the issue where `keepAlive` and `keepAliveProbes` were not being used.

---