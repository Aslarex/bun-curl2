# BunCurl2 🚀

BunCurl2 is a **super-fast, fetch-like HTTP client** for [Bun](https://bun.sh)! Built and maintained as a solo project, it leverages Bun’s powerful child processes combined with cURL to deliver blazing performance, advanced TLS options, and flexible caching solutions. Redis caching is enabled by default, but you can also opt for local, memory-based caching using JavaScript's built-in Map object.

---

## ✨ Features

- **Fetch-like API:**  
  Intuitive and familiar HTTP methods (`GET`, `POST`, etc.) with extended capabilities.
- **Lightning Fast:**  
  Powered by Bun’s child processes and optimized cURL integration.
- **HTTP/2 & HTTP/3 Support:**  
  Take advantage of modern protocols (requires appropriate cURL build).
- **Custom TLS & Ciphers:**  
  Enhance security by fine-tuning TLS settings.
- **Flexible Caching:**
  - **Default (recommended):** Redis, ideal for persistent or long-lived caching.
  - **Optional:** Local, memory-based caching using JavaScript's Map object, suitable for short-term caching within the same process.
- **Type-Safe Requests & Responses:**  
  Enjoy clear and maintainable TypeScript typings.
- **Custom Transformations:**  
  Modify and tailor requests and responses according to your needs.

---

## 📜 Changelog

> **What's New?**  
> Stay informed about updates and improvements by checking our **[Changelog](./CHANGELOG.md)**.  
> _Your go-to resource for release notes and feature highlights!_ 🔥

---

## ⚙️ Installation

```bash
bun add bun-curl2
```

---

## 📋 Requirements

| Tool | Minimum Version | Recommended Version |
| ---- | --------------- | ------------------- |
| Bun  | ^1.2.0          | Latest              |
| cURL | ^7.0.0          | Latest              |

> **Note:** For optimal performance and compatibility, always use the latest versions.  
> I personally use [stunnel/static-curl](https://github.com/stunnel/static-curl) with quictls for cURL builds.

---

## 📡 Usage

### Recommended: Creating a Client Instance

This approach provides the best experience with advanced configurations and caching.

```ts
import BunCurl2, { RequestInit, ResponseInit } from 'bun-curl2';

// Create a new client with customized options and caching.
const client = new BunCurl2({
  defaultAgent: 'MyCustomAgent/1.0',
  compress: true,
  cache: {
    mode: 'redis', // Recommended caching mode
    options: { url: 'redis://localhost:6379' },
    defaultExpiration: 60, // Cache expiration in seconds
  },
  tcp: {
    fastOpen: true,
    noDelay: true,
  },
  transformRequest: opts => opts,
});

// (Optional) Initialize cache if caching is enabled.
await client.connect();

// Make a GET request with type-safe response handling:
const req: ResponseInit<Record<string, string>> = await client.get(
  'https://api.example.com/data',
  { cache: true }
);

/*
Response Details:
- status: HTTP status code
- response: Parsed response (here: Record<string, string>)
- headers: Headers instance
- Helper methods: json(), text(), arrayBuffer(), blob()
*/
console.log('Status:', req.status);
console.log('Response:', req.response);
```

### Alternative: Direct `fetch`-like Usage

For simpler use cases, you can directly use a familiar fetch-like syntax:

```ts
import { fetch } from 'bun-curl2';

const req: ResponseInit<string> = await fetch<string>(
  'https://www.example.com'
);

console.log('Status:', req.status);
console.log('Response:', req.response);
```

---

## 🔧 Advanced Options

- **Proxy Support:**  
  Formats supported:
  - `ip:port`
  - `ip:port:user:pass`
  - `user:pass@ip:port`
- **Custom Headers & Body:**  
  Supports sending strings, objects, Blobs, BufferSources, FormData, URLSearchParams, and ReadableStreams.  
  Automatically detects `Content-Type`, but setting manually is recommended.

- **TLS & Cipher Configuration:**  
  Customize TLS versions and cipher suites for enhanced security.

- **Caching Modes:**  
  Redis caching is recommended for persistent caching needs, while local, memory-based caching (via Map) is ideal for short-term, in-process storage.

---

## 🔍 Under the Hood

- **Bun Child Processes + cURL:**  
  Combines the strengths of Bun and cURL for top-tier performance.
- **Fully Typed Interfaces:**  
  Comprehensive TypeScript typings improve development experience.
- **Robust Caching:**  
  Efficient caching solutions using Redis or JavaScript's built-in Map.

---

## 🤝 Contributing

As this is a solo-maintained project, your feedback, issues, or pull requests are warmly welcomed! Please keep contributions friendly and respectful.

---

## 🏳️ License

This project is proudly licensed under the **[WTFPL](./LICENSE)**.
