import { $ } from 'bun';
import TTLCache from '../services/cache';

// Define constants for CURL options.
const CURL = {
  BASE: 'curl' as const,
  SILENT: '-s' as const,
  SHOW_ERROR: '-S' as const,
  WRITE_OUT: '-w' as const,
  INFO: '-i' as const,
  TIMEOUT: '-m' as const,
  CONNECT_TIMEOUT: '--connect-timeout' as const,
  HTTP_VERSION: {
    3.0: '--http3' as const,
    2.0: '--http2' as const,
    1.1: '--http1.1' as const,
  },
  INTERFACE: '--interface' as const,
  INSECURE: '--insecure' as const,
  TLSv1_0: '--tlsv1.0' as const,
  TLSv1_1: '--tlsv1.1' as const,
  TLSv1_2: '--tlsv1.2' as const,
  TLSv1_3: '--tlsv1.3' as const,
  CIPHERS: '--ciphers' as const,
  TLS_MAX: '--tls-max' as const,
  TLS13_CIPHERS: '--tls13-ciphers' as const,
  COMPRESSED: '--compressed' as const,
  PROXY: '--proxy' as const,
  FOLLOW: '--location' as const,
  MAX_REDIRS: '--max-redirs' as const,
  NO_KEEPALIVE: '--no-keepalive' as const,
  KEEPALIVE_TIME: '--keepalive-time' as const,
  KEEPALIVE_CNT: '--keepalive-cnt' as const,
  DATA_RAW: '--data-raw' as const,
  DNS_SERVERS: '--dns-servers' as const,
  DNS_RESOLVE: '--resolve' as const,
  TCP_FASTOPEN: '--tcp-fastopen' as const,
  TCP_NODELAY: '--tcp-nodelay' as const,
  USER_AGENT: '-A' as const,
  HEADER: '-H' as const,
  METHOD: '-X' as const,
  HEAD: '-I' as const,
};

const TLS = {
  /**
   * TLS 1.0
   */
  Version10: 0x0301,
  /**
   * TLS 1.1
   */
  Version11: 0x0302,
  /**
   * TLS 1.2
   */
  Version12: 0x0303,
  /**
   * TLS 1.3
   */
  Version13: 0x0304,
} as const;

const HTTP = {
  /** HTTP 1.1 */
  Version11: 1.1,
  /** HTTP 2.0 */
  Version20: 2.0,
  /** HTTP 3.0 */
  Version30: 3.0,
} as const;

const PROTOCOL_PORTS: Record<string, number> = {
  'http:': 80,
  'https:': 443,
  'ftp:': 21,
  'ftps:': 990,
  'sftp:': 22,
  'scp:': 22,
  'smtp:': 25,
  'smtps:': 465,
  'imap:': 143,
  'imaps:': 993,
  'pop3:': 110,
  'pop3s:': 995,
  'ldap:': 389,
  'ldaps:': 636,
  'mqtt:': 1883,
  'mqtts:': 8883,
  'telnet:': 23,
  'tftp:': 69,
  'rtsp:': 554,
  'smb:': 445,
  'dict:': 2628,
};

const CURL_OUTPUT = (await $`curl --version`.quiet().text()).toLowerCase();

const curlVersionMatch = CURL_OUTPUT.match(/curl\s+(\d+.\d+.\d+)/);

const CURL_VERSION = curlVersionMatch ? curlVersionMatch[1] : '0.0.0';

const DNS_CACHE = new TTLCache<string>({ maxItems: 255 });

export {
  CURL,
  PROTOCOL_PORTS,
  CURL_VERSION,
  CURL_OUTPUT,
  TLS,
  HTTP,
  DNS_CACHE,
};
