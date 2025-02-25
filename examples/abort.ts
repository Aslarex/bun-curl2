import { Http } from '../src/index';

// Create an AbortController instance
const controller = new AbortController();

// Start the HTTP call with the abort signal
const requestPromise = Http('https://reqres.in/api/users?delay=1', {
  signal: controller.signal,
});

// Abort the request after 100 milliseconds
setTimeout(() => {
  console.log('Aborting the request...');
  controller.abort();
}, 300);

try {
  const res = await requestPromise;
  console.log('Request completed successfully (this was not expected).', res);
} catch (error: any) {
  if (error.name === 'AbortError') {
    console.log('AbortError caught as expected.');
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
