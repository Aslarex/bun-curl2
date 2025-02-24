/**
 * Formats a proxy connection string.
 *
 * If the input already starts with a protocol (e.g. "http://"), that protocol is used
 * unless a protocol override is provided. The function supports both authenticated
 * proxies (format: "ip:port:username:password") and non‑authenticated proxies (format: "ip:port").
 *
 * @param input - The proxy string. It may optionally start with a protocol.
 * @param protocolOverride - Optional protocol to force (if not provided, the input’s protocol or "http" is used).
 * @returns The formatted proxy URL.
 *
 * @throws Error if the input format is invalid.
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
    // Remove the protocol portion from the input
    input = input.slice(protocolMatch[0].length);
  }

  // Split the remaining string by colon
  const parts = input.split(':');

  // Non‑authenticated proxy: "ip:port"
  if (parts.length === 2) {
    const [ip, port] = parts;
    return `${protocol}://${ip}:${port}`;
  }
  // Authenticated proxy: "ip:port:username:password"
  else if (parts.length === 4) {
    const [ip, port, username, password] = parts;
    return `${protocol}://${username}:${password}@${ip}:${port}`;
  } else {
    throw new Error(
      'Invalid input format. Expected either "ip:port" or "ip:port:username:password", with an optional protocol prefix.'
    );
  }
}
