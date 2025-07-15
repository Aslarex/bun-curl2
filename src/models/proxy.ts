const HOST_REGEX = /^[\w-]+(\.[\w-]+)*$|^\d{1,3}(?:\.\d{1,3}){3}$/;
const PORT_REGEX = /^[0-9]+$/;

export default function formatProxyString(
  input: string,
  protocolOverride?: string,
): string {
  let protocol = protocolOverride ?? 'http';
  const protoSep = input.indexOf('://');
  if (protoSep > 0) {
    protocol = protocolOverride ?? input.slice(0, protoSep);
    input = input.slice(protoSep + 3);
  }

  let creds: string | null = null;
  const atIdx = input.indexOf('@');
  if (atIdx > -1) {
    creds = input.slice(0, atIdx);
    input = input.slice(atIdx + 1);
  }

  const parts = input.split(':');
  let host: string;
  let port: string;
  let user: string | undefined;
  let pass: string | undefined;

  if (creds !== null) {
    const sep = creds.indexOf(':');
    if (sep < 1) throw new Error(`Invalid credentials: "${creds}"`);
    user = creds.slice(0, sep);
    pass = creds.slice(sep + 1);
    if (!user || !pass) throw new Error(`Invalid credentials: "${creds}"`);
    if (parts.length !== 2)
      throw new Error(`Invalid proxy format: expected host:port after "@"`);
    [host, port] = parts;
  } else if (parts.length === 2) {
    [host, port] = parts;
  } else if (parts.length === 4) {
    [host, port, user, pass] = parts;
    if (!user || !pass) throw new Error(`Invalid credentials in "${input}"`);
  } else {
    throw new Error(
      `Bad proxy format: "${input}". ` +
        `Use "ip:port", "ip:port:user:pass", or "user:pass@ip:port".`,
    );
  }

  if (!HOST_REGEX.test(host)) throw new Error(`Invalid host: "${host}"`);
  const portNum = +port;
  if (!PORT_REGEX.test(port) || portNum < 1 || portNum > 65535)
    throw new Error(`Invalid port: "${port}"`);

  const auth = user && pass ? `${user}:${pass}@` : '';
  return `${protocol}://${auth}${host}:${port}`;
}
