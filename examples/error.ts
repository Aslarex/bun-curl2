/**
 * Example: Handling Errors with bun-curl2's fetch
 *
 * This example demonstrates how to handle errors when using the fetch
 * function from bun-curl2. In this scenario, a request is made to an invalid
 * hostname which results in an error. The error object includes the request
 * options (such as the URL) and an error message, which are both logged for debugging.
 */

import { fetch } from '../src';

try {
  // Attempt to fetch from an invalid hostname.
  await fetch('https://www.doesntexist123.com');
} catch (error: any) {
  // Log the request options provided within the error object.
  console.error('Request Options:', error.options);

  // Log the error message for further insight.
  console.error('Error Message:', error.message);
}
