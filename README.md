---

# BunCurl2 🚀

BunCurl2 is a **super-fast, fetch-like HTTP client** for [Bun](https://bun.sh)! Built and maintained by me as a solo project, it leverages Bun’s child processes and cURL to deliver blazing performance, advanced TLS options, and flexible caching (default: Redis; optional: local).

---

## ✨ Features

- **Fetch-like API:**  
  Use familiar HTTP methods (`GET`, `POST`, etc.) with extra capabilities.
- **Lightning Fast:**  
  Powered by Bun’s child processes + cURL.
- **HTTP/2 & HTTP/3:**  
  Enjoy modern protocols (*if your cURL supports them*).
- **Custom TLS & Ciphers:**  
  Tweak your security settings.
- **Caching Options:**  
  - **Default:** Redis (recommended)  
  - **Optional:** Local in-memory cache (via Map)
- **Type-Safe Requests & Responses:**  
  Specify your request/response types for clarity.
- **Custom Transformations:**  
  Modify requests & responses with your own functions.

---

## 📜 Changelog

> **What's New?**  
> Keep track of all updates and improvements in our **[Changelog](./CHANGELOG.md)**.  
> _Your one-stop guide for release notes and feature changes!_ 🔥

---

## ⚙️ Installation

```bash
bun add bun-curl2
```

---

## 📡 Usage

### As a Client Instance

```ts
import BunCurl2, { RequestInit, ResponseInit } from 'bun-curl2';

// Create a new client with custom options and caching configuration.
const client = new BunCurl2({
  defaultAgent: 'MyCustomAgent/1.0',
  compress: true,
  cache: {
    // Default caching mode is Redis; switch to 'local' for in-memory caching.
    mode: 'redis',
    options: { url: 'redis://localhost:6379' },
    defaultExpiration: 60, // in seconds
  },
  transfomRequest: (opts) => opts,
});

// (Optional) Initialize cache if caching is enabled.
await client.initializeCache();

// Make a GET request with explicit request & response types:
const req: ResponseInit<Record<string, string>> = await client.get(
  'https://api.example.com/data',
  { cache: { keys: ['headers'] } }
);

/*
Response Type Details:
- status: number – HTTP status code.
- response: Parsed response (here: Record<string, string>).
- headers: Instance of Headers.
- Helper methods: json(), text(), arrayBuffer(), blob().
*/
console.log('Status:', req.status);
console.log('Response:', req.response);
```

### Direct `fetch`-like Usage

```ts
import { Http } from 'bun-curl2';

const req: ResponseInit<string> = await Http<string>('https://www.example.com');
console.log('Status:', req.status);
console.log('Response:', req.response);
```

---

## 🔧 Advanced Options

- **Proxy Support:**  
  Use formats like:
  - `ip:port`
  - `ip:port:user:pass`
  - `user:pass@ip:port`
  
- **Custom Headers & Body:**  
  Send headers and request bodies (supports: string, object, Blob, BufferSource, FormData, URLSearchParams, or ReadableStream).  
  BunCurl2 auto-detects `Content-Type` when possible—override it manually if needed.

- **TLS & Cipher Settings:**  
  Customize TLS versions and cipher suites for robust security.

- **Caching Modes:**  
  Redis is the default mode. Switch to **local** (in-memory) caching if desired.

---

## 🔍 Under the Hood

- **Bun Child Processes + cURL:**  
  Executes requests using cURL for impressive performance.
- **Type-Safe Interfaces:**  
  Comprehensive TypeScript types for request options and response objects.
- **Flexible Caching:**  
  Cache responses with either Redis or a local Map (with configurable expiration).

---

## 🤝 Contributing

This is a solo project maintained by me. Feedback, issues, or pull requests are welcome on GitHub—but please keep it friendly!

---

## 🏳️ License

This project is licensed under the **WTFPL** – [Do What The Fuck You Want To Public License](https://en.wikipedia.org/wiki/WTFPL).

---