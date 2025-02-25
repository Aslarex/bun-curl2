/**
 * Validates that the given port string represents a valid port number.
 *
 * @param port - The port string.
 * @returns True if valid, false otherwise.
 */
function isValidPort(port: string): boolean {
  const num = Number(port);
  return Number.isInteger(num) && num > 0 && num <= 65535;
}

/**
 * Basic validation for an IP address or hostname.
 * (Extend this function if more strict checks are needed.)
 *
 * @param host - The host string.
 * @returns True if valid, false otherwise.
 */
function isValidHost(host: string): boolean {
  return host.length > 0;
}

/**
 * Formats a proxy connection string with improved validation.
 *
 * Supports:
 * - Non‑authenticated proxies: "ip:port"
 * - Authenticated proxies: "ip:port:username:password"
 * - Already formatted credentials: "username:password@ip:port"
 *
 * If the input already starts with a protocol (e.g. "http://"), that protocol is used
 * unless a protocol override is provided.
 *
 * @param input - The proxy string. It may optionally start with a protocol.
 * @param protocolOverride - Optional protocol to force (if not provided, the input’s protocol or "http" is used).
 * @returns The formatted proxy URL.
 *
 * @throws Error if the input format or any part of it is invalid.
 */
export default function formatProxyString(
  input: string,
  protocolOverride?: string
): string {
  // Default protocol if none is found and no override is provided.
  let protocol = protocolOverride || 'http';

  // Check if the input already starts with a protocol (e.g. "http://")
  const protocolMatch = input.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  if (protocolMatch) {
    // Use the override if provided; otherwise, use the protocol from the input.
    protocol = protocolOverride || protocolMatch[1];
    // Remove the protocol portion from the input.
    input = input.slice(protocolMatch[0].length);
  }

  // Check if the input contains an "@" symbol (i.e. already formatted credentials: "user:pass@ip:port")
  if (input.includes('@')) {
    const [credentials, hostPort] = input.split('@');
    const [username, password] = credentials.split(':');
    if (!username || !password) {
      throw new Error(
        'Invalid credentials format. Expected "username:password".'
      );
    }
    const [host, port] = hostPort.split(':');
    if (!isValidHost(host)) {
      throw new Error('Invalid host.');
    }
    if (!isValidPort(port)) {
      throw new Error('Invalid port.');
    }
    return `${protocol}://${credentials}@${host}:${port}`;
  }

  // Split the remaining string by colon.
  const parts = input.split(':');

  // Non‑authenticated proxy: "ip:port"
  if (parts.length === 2) {
    const [host, port] = parts;
    if (!isValidHost(host)) {
      throw new Error('Invalid host.');
    }
    if (!isValidPort(port)) {
      throw new Error('Invalid port.');
    }
    return `${protocol}://${host}:${port}`;
  }
  // Authenticated proxy: "ip:port:username:password"
  else if (parts.length === 4) {
    const [host, port, username, password] = parts;
    if (!isValidHost(host)) {
      throw new Error('Invalid host.');
    }
    if (!isValidPort(port)) {
      throw new Error('Invalid port.');
    }
    if (!username || !password) {
      throw new Error(
        'Invalid credentials. Username and password must be provided.'
      );
    }
    return `${protocol}://${username}:${password}@${host}:${port}`;
  } else {
    throw new Error(
      'Invalid input format. Expected either "ip:port", "ip:port:username:password", or an already formatted "username:password@ip:port", with an optional protocol prefix.'
    );
  }
}
