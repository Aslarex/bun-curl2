/**
 * Example: Aborting an HTTP Request with bun-curl2
 *
 * This example demonstrates how to abort an HTTP request using the built-in
 * AbortController and the Http function from bun-curl2.
 *
 * The HTTP call is initiated with an abort signal. If the request takes too long,
 * it will be aborted after 100 milliseconds.
 */

import { Http } from '../src/index';

// Create an AbortController instance.
const controller = new AbortController();

// Start the HTTP request with the abort signal.
const requestPromise = Http('https://reqres.in/api/users?delay=1', {
  signal: controller.signal,
  tls: {
    insecure: true,
  },
});

// Abort the request after 100 milliseconds.
setTimeout(() => {
  console.log('Aborting the request...');
  controller.abort();
}, 100);

try {
  // Await the request promise.
  const res = await requestPromise;
  console.log('Request completed successfully (this was not expected).', res);
} catch (error: any) {
  // Handle the error by checking if it is an AbortError.
  if (error.name === 'AbortError') {
    console.log('AbortError caught as expected.');
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
