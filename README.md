---

# BunCurl

BunCurl is a high-performance, fetch-like HTTP client for Node.js powered by [Bun](https://bun.sh) that leverages native child processes and curl under the hood. It’s built to be blazing fast—especially when using proxies—and supports modern HTTP protocols (HTTP/2 & HTTP/3), advanced TLS configuration, and optional caching via Redis.

## Features

- **Fetch-like API:**  
  Use familiar HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`) with additional options for fine-tuning your requests.

- **Lightning-fast Performance:**  
  Executes requests using Bun’s child processes and curl, making it faster than the native fetch in many scenarios—especially when using proxies.

- **HTTP/2 & HTTP/3 Support:**  
  Automatically uses HTTP/2 or HTTP/3 if your installed version of curl supports it.

- **Advanced TLS & Cipher Configuration:**  
  Configure custom TLS versions and ciphers (TLS1.2 and TLS1.3) to meet your security requirements.

- **Optional Redis Caching:**  
  Improve performance by caching responses. Redis is loaded dynamically so it’s completely optional. Just add a cache configuration and your requests will be cached automatically.

- **Customizable Request Transformations:**  
  Easily transform requests and responses via user-supplied functions.

## Installation

Install BunCurl via npm or yarn. Since Redis is an optional dependency, it’s marked in `optionalDependencies`.

```bash
npm install bun-curl
# or
yarn add bun-curl
```

If you plan on using caching, ensure you also install [redis](https://www.npmjs.com/package/redis):

```bash
npm install redis
# or
yarn add redis
```

## Usage

Below is a basic example that shows how to use BunCurl for a simple GET request:

```ts
import BunCurl from 'bun-curl';

(async () => {
  // Create an instance with optional caching configuration.
  const client = new BunCurl({
    defaultAgent: 'MyCustomUserAgent/1.0',
    compress: true,
    // Optional caching configuration:
    cache: {
      options: {
        // Redis client options
        url: 'redis://localhost:6379'
      },
      defaultExpiration: 60, // Cache expiration in seconds
    },
    // Optional: custom transformation for requests/responses
    transfomRequest: (opts) => {
      // Modify options as needed...
      return opts;
    },
  });

  // Initialize Redis cache if needed
  await client.initializeCache();

  // Perform a GET request
  const response = await client.get('https://api.example.com/data');

  console.log('Status:', response.status);
  console.log('Response:', await response.json());
})();
```

### Advanced Request Options

BunCurl supports a wide range of options similar to the standard fetch API with extra features:

- **Proxy Support:**  
  Specify a proxy in the request options for improved performance.
  
- **Custom Headers & Body:**  
  Set headers and a request body as either a plain object or string. BunCurl automatically sets the appropriate `Content-Type`.

- **TLS & Cipher Options:**  
  Pass TLS options to configure supported protocols, cipher suites for TLS1.2/TLS1.3, and more.

- **HTTP Versions:**  
  Automatically selects the HTTP version based on the request. If a proxy is set, HTTP/2 is used by default. You can also override this by passing an `http.version` option.

## Under the Hood

- **Bun Child Processes & curl:**  
  BunCurl spawns child processes using Bun and executes curl commands under the hood. This provides superior performance over standard fetch, especially when dealing with high-latency proxies.

- **Dynamic Redis Loading:**  
  Redis is loaded only when caching is enabled. This means your library remains lightweight for users who don’t need caching.

- **Optimized for Speed:**  
  With native support for multiple HTTP versions and optimized TLS handling, BunCurl is designed for environments where speed and efficiency matter.

## Contributing

Contributions are welcome! Feel free to open issues, fork the repository, and submit pull requests. Please follow our code style and add tests where appropriate.