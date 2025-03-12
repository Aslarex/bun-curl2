import { $ } from 'bun';

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
  TLSv1_2: '--tlsv1.2',
  CIPHERS: '--ciphers',
  TLS_MAX: '--tls-max',
  TLSv1_3: '--tlsv1.3',
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
};

// Default ciphers
const CIPHERS = {
  TLS12:
    'ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA',
  TLS13:
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
};

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

const DEFAULT_DNS_SERVERS = ['8.8.8.8', '8.8.4.4'];

const CURL_OUTPUT = (await $`curl --version`.quiet().text()).toLowerCase();

const curlVersionMatch = CURL_OUTPUT.match(/curl\s+(\d+.\d+.\d+)/);

const CURL_VERSION = curlVersionMatch ? curlVersionMatch[1] : '0.0.0';

export {
  CURL,
  CIPHERS,
  PROTOCOL_PORTS,
  DEFAULT_DNS_SERVERS,
  CURL_VERSION,
  CURL_OUTPUT,
};
