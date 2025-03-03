import BunCurl2 from '../src';

const testCurl = new BunCurl2({
  transfomRequest(args) {
    if (args.headers) {
      if (args.headers instanceof Headers) {
        args.headers.set('x-required-header', 'some_random_value');
      } else {
        args.headers['x-required-header'] = 'some_random_value';
      }
    } else {
      args.headers = {
        'x-required-header': 'some_random_value',
      };
    }
    if (args.url.includes('/post')) args.method = 'POST';
    return args;
  },
});

// get request
const example_get = await testCurl.get('https://httpbin.org/anything');

console.log(example_get.response /** any */);

// post request with body
const example_post = await testCurl.fetch<{ data: string }>(
  'https://httpbin.org/post',
  {
    body: {
      json_key: 'json_value',
    },
    transformRequest: false, // disable global transform for this request
  }
);

console.log(example_post.response); // Should result in:
/*
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
<title>405 Method Not Allowed</title>
<h1>Method Not Allowed</h1>
<p>The method is not allowed for the requested URL.</p>
*/
