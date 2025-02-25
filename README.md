# BunCurl2

BunCurl2 is a high-performance, fetch-like HTTP client built with [Bun](https://bun.sh) that leverages child processes and cURL under the hood. BunCurl2 supports HTTP/2 and HTTP/3 (if your system's curl supports them), advanced TLS configurations with custom ciphers and TLS versions, and optional caching via Redis.

## [Changelog](./CHANGELOG.md)

## Features

- **Fetch-like API:**  
  Use familiar HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`) with additional options for advanced configurations.

- **High Performance:**  
  Executes requests using Bun's child processes and curl, making it significantly faster than the native fetch in many scenarios, especially when proxies are used.

- **HTTP/2 & HTTP/3 Support:**  
  Defaults to HTTP/2, can be overriden by `http` property. Make sure your **cURL** version supports HTTP/3 if you want to use it.

- **Advanced TLS & Cipher Configuration:**  
  Customize TLS versions and cipher suites (for TLS1.2 and TLS1.3) to meet your security requirements.

- **Optional Redis Caching:**  
  Improve performance by caching responses.  

- **Customizable Transformations:**  
  Transform request and response options via user-supplied functions for full control over HTTP interactions.

## Installation

Installing BunCurl2 is straightforward and easy.
```bash
bun add bun-curl2 
```

## Usage

Below is a basic example using BunCurl2 for a GET request:

```ts
import BunCurl2 from 'bun-curl2';

// Create an instance with optional caching configuration.
const client = new BunCurl2({
  defaultAgent: 'MyCustomUserAgent/1.0',
  compress: true,
  cache: {
    options: {
      url: 'redis://localhost:6379'
    },
    defaultExpiration: 60, // Default entries expiration in seconds
  },
  transfomRequest: (opts) => {
    // Modify options as needed...
    return opts;
  },
});

// Initialize cache if needed
await client.initializeCache();

// Perform a GET request
const req = await client.get<Record<string, string>>('https://api.example.com/data', { cache: { keys: ["headers"] /** Properties that will be used that will be transformed to cache key, DEFAULT: **`headers, body, proxy, method`** */ } });

console.log('Status:', req.status /* number */);
console.log('Response:', req.response /* Record<string, string> */);
```

Or if you only want to use it directly like fetch:

```ts
import { Http } from "bun-curl2";

const req = await Http<string>("https://www.example.com");

console.log('Status:', req.status /* number */);
console.log('Response:', req.response /* string */);
```

## Advanced Options

- **Proxy Support:**  
  Easily proxy the requests by providing it.
  Supported formats (all of them can have protocol optionally as a prefix):
   - ip:port
   - ip:port:user:pass
   - user:pass@ip:port

- **Custom Headers & Body:**  
  Pass headers and request body (as a string or object). BunCurl2 automatically sets the appropriate `Content-Type` if not provided in headers.

- **TLS & Cipher Settings:**  
  Specify TLS versions and cipher suites for secure communication.

- **Dynamic Redis Caching:**  
  Enable caching with optional Redis support to store and reuse responses for improved performance.  
  **Important:** Ensure that your Redis server is configured correctly and that you have installed the Redis package in your project.

## Under the Hood

- **Bun Child Processes & curl:**  
  BunCurl2 uses Bun's child process capabilities to execute curl commands, delivering impressive speed improvements.

## Contributing

Contributions are welcome! If you encounter issues or have suggestions, please open an issue or submit a pull request on GitHub.

## License

MIT License