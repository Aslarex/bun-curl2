import { $ } from 'bun';
import { LocalCache } from '../services/cacheStore';

// Define constants for CURL options.
const CURL = {
  BASE: 'curl',
  SILENT: '-s',
  SHOW_ERROR: '-S',
  WRITE_OUT: '-w',
  INFO: '-i',
  TIMEOUT: '-m',
  CONNECT_TIMEOUT: '--connect-timeout',
  HTTP_VERSION: {
    3.0: '--http3',
    2.0: '--http2',
    1.1: '--http1.1',
  },
  INSECURE: '--insecure',
  TLSv1_0: '--tlsv1.0',
  TLSv1_1: '--tlsv1.1',
  TLSv1_2: '--tlsv1.2',
  TLSv1_3: '--tlsv1.3',
  CIPHERS: '--ciphers',
  TLS_MAX: '--tls-max',
  TLS13_CIPHERS: '--tls13-ciphers',
  COMPRESSED: '--compressed',
  PROXY: '--proxy',
  FOLLOW: '--location',
  MAX_REDIRS: '--max-redirs',
  NO_KEEPALIVE: '--no-keepalive',
  KEEPALIVE_TIME: '--keepalive-time',
  KEEPALIVE_CNT: '--keepalive-cnt',
  DATA_RAW: '--data-raw',
  DNS_SERVERS: '--dns-servers',
  DNS_RESOLVE: '--resolve',
  TCP_FASTOPEN: '--tcp-fastopen',
  TCP_NODELAY: '--tcp-nodelay',
  USER_AGENT: '-A',
  HEADER: '-H',
  METHOD: '-X',
  HEAD: '-I',
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

const PROTOCOL_PORTS = {
  http: 80,
  https: 443,
  ftp: 21,
  ftps: 990,
  sftp: 22,
  scp: 22,
  smtp: 25,
  smtps: 465,
  imap: 143,
  imaps: 993,
  pop3: 110,
  pop3s: 995,
  ldap: 389,
  ldaps: 636,
  mqtt: 1883,
  mqtts: 8883,
  telnet: 23,
  tftp: 69,
  rtsp: 554,
  smb: 445,
  dict: 2628,
} as Record<string, number>;

const CURL_OUTPUT = (await $`curl --version`.quiet().text()).toLowerCase();

const curlVersionMatch = CURL_OUTPUT.match(/curl\s+(\d+.\d+.\d+)/);

const CURL_VERSION = curlVersionMatch ? curlVersionMatch[1] : '0.0.0';

const DNS_CACHE_MAP = new LocalCache<string>({
  maxItems: 255,
  noInterval: true,
});

export {
  CURL,
  PROTOCOL_PORTS,
  CURL_VERSION,
  CURL_OUTPUT,
  TLS,
  DNS_CACHE_MAP,
};
