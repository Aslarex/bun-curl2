```
# BunCurl

BunCurl is a high-performance, fetch-like HTTP client built with Bun (bun.sh) that leverages child processes and curl under the hood. Designed for speed—especially when using proxies—BunCurl supports HTTP/2 and HTTP/3 (if your system's curl supports them), advanced TLS configurations with custom ciphers and TLS versions, and optional caching via Redis.

> **Project Status:** This project is fairly new and still in active development. You may encounter bugs or errors—please report any issues on GitHub.

## Features

- **Fetch-like API:**  
  Use familiar HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`) with additional options for advanced configurations.

- **High Performance:**  
  Executes requests using Bun's child processes and curl, making it significantly faster than the native fetch in many scenarios, especially when proxies are used.

- **HTTP/2 & HTTP/3 Support:**  
  Automatically selects HTTP/2 or HTTP/3 if supported by your system's curl.

- **Advanced TLS & Cipher Configuration:**  
  Customize TLS versions and cipher suites (for TLS1.2 and TLS1.3) to meet your security requirements.

- **Optional Redis Caching:**  
  Improve performance by caching responses. Redis is loaded dynamically, making it optional.

- **Customizable Transformations:**  
  Transform request and response options via user-supplied functions for full control over HTTP interactions.

## Installation

Install BunCurl via npm or yarn. Redis is an optional dependency, so caching functionality will work only if Redis is installed.

```bash
npm install bun-curl
# or
yarn add bun-curl
```

If you plan on using caching, install Redis as well:

```bash
npm install redis
# or
yarn add redis
```

## Usage

Below is a basic example using BunCurl for a GET request:

```ts
import BunCurl from 'bun-curl';

(async () => {
  // Create an instance with optional caching configuration.
  const client = new BunCurl({
    defaultAgent: 'MyCustomUserAgent/1.0',
    compress: true,
    cache: {
      options: {
        url: 'redis://localhost:6379'
      },
      defaultExpiration: 60, // Cache expiration in seconds
    },
    transfomRequest: (opts) => {
      // Modify options as needed...
      return opts;
    },
  });

  // Initialize cache if needed
  await client.initializeCache();

  // Perform a GET request
  const response = await client.get('https://api.example.com/data');

  console.log('Status:', response.status);
  console.log('Response:', await response.json());
})();
```

## Advanced Options

- **Proxy Support:**  
  Configure proxies to improve request performance.

- **Custom Headers & Body:**  
  Pass headers and request body (as a string or object). BunCurl automatically sets the appropriate `Content-Type`.

- **TLS & Cipher Settings:**  
  Specify TLS versions and cipher suites for secure communication.

- **Dynamic Redis Caching:**  
  Enable caching with optional Redis support to store and reuse responses for improved performance.

## Under the Hood

- **Bun Child Processes & curl:**  
  BunCurl uses Bun's child process capabilities to execute curl commands, delivering impressive speed improvements.

- **Optimized for High Traffic:**  
  This library is designed for use in high-traffic projects where thousands of clients surf daily. As such, it will be updated frequently and quickly to meet performance and reliability demands.

## Contributing

Contributions are welcome! If you encounter issues or have suggestions, please open an issue or submit a pull request on GitHub.

## License

MIT License
```