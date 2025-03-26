/**
 * Example: Aborting an HTTP Request with bun-curl2
 *
 * This example demonstrates how to abort an HTTP request using the built-in
 * AbortSignal with timeout and the Http function from bun-curl2.
 *
 * The HTTP call is initiated with an abort signal. If the request takes too long,
 * it will be aborted after 100 milliseconds.
 */

import { Http } from '../src/index';

// Start the HTTP request with the abort signal.
const requestPromise = Http('https://reqres.in/api/users?delay=1', {
  signal: AbortSignal.timeout(100),
  tls: {
    insecure: true,
  },
});

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
