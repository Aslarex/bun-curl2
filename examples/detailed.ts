/**
 * Detailed Example of bun-curl2 Usage with Top-Level Await
 *
 * This example demonstrates how to initialize and use BunCurl2 with various options.
 * It covers examples for GET, POST, PUT, DELETE, PATCH, and HEAD requests.
 * Global settings include a default user agent, compression, and TCP options.
 * A global request transformer is provided to add a custom header and modify the HTTP method based on the URL.
 *
 * Note: The TLS configuration option is not supported in BunCurl2.
 */

import BunCurl2 from '../src';

// Create a BunCurl2 instance with global configuration options.
const bunCurl = new BunCurl2({
  // Set a default user agent if none is provided.
  defaultAgent: 'bun-curl2/1.0',
  // Enable response compression.
  compress: true,
  // TCP options to optimize connection performance.
  tcp: { fastOpen: true, noDelay: true },
  // Global request transformer:
  // Adds a custom header and, if the URL contains '/submit', forces the method to POST.
  transformRequest(args) {
    if (args.headers) {
      if (args.headers instanceof Headers) {
        args.headers.set('x-global-header', 'global_value');
      } else {
        args.headers['x-global-header'] = 'global_value';
      }
    } else {
      args.headers = { 'x-global-header': 'global_value' };
    }
    if (args.url.includes('/submit')) {
      args.method = 'POST';
    }
    return args;
  },
  // Optional caching configuration (enabled but not the focus here).
  cache: { mode: 'local', defaultExpiration: 5 },
});

// Initialize resources (for example, cache initialization).
await bunCurl.connect();

// ─── Example 1: GET Request ─────────────────────────────────────────────
const getResponse = await bunCurl.get('https://httpbin.org/anything');
console.log('GET Response:', getResponse.response);
console.log('GET Cached:', getResponse.cached);

// ─── Example 2: POST Request with Disabled Global Transform ──────────────
const postResponse = await bunCurl.fetch('https://httpbin.org/post', {
  body: { data: 'sample data' },
  transformRequest: false,
});
console.log('POST Response:', postResponse.response);

// ─── Example 3: PUT Request ─────────────────────────────────────────────
const putResponse = await bunCurl.put('https://httpbin.org/put', {
  body: { update: 'new value' },
});
console.log('PUT Response:', putResponse.response);

// ─── Example 4: DELETE Request ──────────────────────────────────────────
const deleteResponse = await bunCurl.delete('https://httpbin.org/delete');
console.log('DELETE Response:', deleteResponse.response);

// ─── Example 5: PATCH Request ───────────────────────────────────────────
const patchResponse = await bunCurl.patch('https://httpbin.org/patch', {
  body: { patch: 'value' },
});
console.log('PATCH Response:', patchResponse.response);

// ─── Example 6: HEAD Request ────────────────────────────────────────────
const headResponse = await bunCurl.head('https://httpbin.org/anything');
console.log('HEAD Response Headers:', headResponse.headers);

// Clean up resources.
await bunCurl.disconnect();
console.log('Disconnected from bun-curl2');
