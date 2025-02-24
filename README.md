# BunCurl2

BunCurl2 is a high-performance, fetch-like HTTP client built with [Bun](https://bun.sh) that leverages child processes and curl under the hood. Designed for speed—especially when using proxies—BunCurl2 supports HTTP/2 and HTTP/3 (if your system's curl supports them), advanced TLS configurations with custom ciphers and TLS versions, and optional caching via Redis.

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
  Improve performance by caching responses.  
  **Note:** For caching to work, you must both configure your Redis server **and** have the Redis package installed in your project.

- **Customizable Transformations:**  
  Transform request and response options via user-supplied functions for full control over HTTP interactions.

## Installation

Install BunCurl2 via bun or npm or yarn. Redis is an optional dependency, so caching functionality will work only if Redis is installed **and** properly configured.

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
console.log('Response:', response.json());
```

Or if you only want to use it directly like fetch:

```ts
import { Http } from "bun-curl2";

const response = await Http("https://www.example.com");

console.log('Status:', response.status);
console.log('Response:', response.json());
```

## Advanced Options

- **Proxy Support:**  
  Configure proxies to improve request performance.

- **Custom Headers & Body:**  
  Pass headers and request body (as a string or object). BunCurl2 automatically sets the appropriate `Content-Type`.

- **TLS & Cipher Settings:**  
  Specify TLS versions and cipher suites for secure communication.

- **Dynamic Redis Caching:**  
  Enable caching with optional Redis support to store and reuse responses for improved performance.  
  **Important:** Ensure that your Redis server is configured correctly and that you have installed the Redis package in your project.

## Under the Hood

- **Bun Child Processes & curl:**  
  BunCurl2 uses Bun's child process capabilities to execute curl commands, delivering impressive speed improvements.

- **Optimized for High Traffic:**  
  This library is designed for use in high-traffic projects where thousands of clients surf daily. As such, it will be updated frequently and quickly to meet performance and reliability demands.

## Contributing

Contributions are welcome! If you encounter issues or have suggestions, please open an issue or submit a pull request on GitHub.

## License

MIT License