# Changelog

## [0.0.21] - 2025-02-28

- Added a `local` cache mode! However redis is the default. [EXAMPLE](./examples/cache.ts)
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
- Added AbortController signal support. [EXAMPLE](./examples/abort.ts)
- Fixed Redis logic and TTL issues.
- Fixed response type propagation in `BunCurl2` methods.
- Added `BunCurl2.disconnectCache` method.
- Fixed `keepAlive` and `keepAliveProbes` not being used