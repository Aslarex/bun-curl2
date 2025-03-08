# Changelog

> **Note:** Dates are formatted as `yyyy-mm-dd`.

## [0.0.27] - 2025-03-08

- Added DNS Caching support locally (max 255 entries), configurable by `RequestInit.dns` property.
- Added TCP FastOpen & TCP NoDelay support, configurable by `GlobalInit.tcp` property.
- Improved cache key generation logic & added `generate` function in `RequestInit.cache` property for manually generating the cache key
- Fixed the issue where `RequestInit.follow` property was not set to `true` by default.
- HTTP version does not default to 3.0 anymore if the cURL build supported it.

## [0.0.25] & [0.0.26] - 2025-03-06

- Reduced build size by **~50%**
- Little optimizations, full request now takes **~5%** less time and consumes less memory
- Renamed `parseResponse` to `parseJSON`
- You can now disable response compression per request by providing `compress: false` in request options
- Added `dns` request property.

## [0.0.24] - 2025-03-05

- Mini update that should fix issues regarding http versions & tls ciphers in some versions of cURL

## [0.0.23] - 2025-03-03

- Better error handling [[EXAMPLE]](./examples/error.ts)
- if `follow` property value is **true**, then it will follow redirects up to 10 times.
- `ResponseWrapper.url` value is now final destination url even after redirects.

## [0.0.21] & [0.0.22] - 2025-02-28

- Added a `local` cache mode! However redis is the default. [[EXAMPLE]](./examples/cache.ts)
- `body` property now supports all the types that **fetch** has implemented (EXPERIMENTAL)
- Some more typescript fixes

## [0.0.20] - 2025-02-26

- **⚠️ IMPORTANT:** fixed incorrect argument name passed when `follow` property was provided (`--follow` **->** `--location`)
- Fixed JSDoc comments being removed

## [0.0.19] - 2025-02-25

- Added cache validation support via function. Can be both asynchronous and synchronous
- Added `parseResponse` global support in `BunCurl2` options
- `transformResponse` now accepts promise responses

## [0.0.18] - 2025-02-25

- Added transfomResponse support
- Types are now exported
- Made it possible to provide `transformRequest: false` in options to disable global transformation provided in `BunCurl2` for that specific request

## [0.0.17] - 2025-02-25

- Added backwards compatibility in `package.json`

## [0.0.16] - 2025-02-25
- Added AbortController signal support. [[EXAMPLE]](./examples/abort.ts)
- Fixed Redis logic and TTL issues.
- Fixed response type propagation in `BunCurl2` methods.
- Added `BunCurl2.disconnectCache` method.
- Fixed `keepAlive` and `keepAliveProbes` not being used