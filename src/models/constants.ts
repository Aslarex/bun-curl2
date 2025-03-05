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
  USER_AGENT: '-A',
  HEADER: '-H',
  METHOD: '-X',
};

// Default ciphers
const CIPHERS = {
  TLS12:
    'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-SHA256:AES256-SHA256:AES128-SHA:AES256-SHA',
  TLS13:
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
};

const CURL_VERSION = (await $`curl --version`.quiet().text()).toLowerCase();

const SUPPORTS_HTTP2 = CURL_VERSION.includes('http2');

const SUPPORTS_HTTP3 = CURL_VERSION.includes('http3');

const supportedTlsLibs = [
  'openssl',
  'libressl',
  'boringssl',
  'quictls',
  'woflssl',
  'gnutls',
];

const SUPPORTS_CIPHERS_ARGS = supportedTlsLibs.some(lib =>
  CURL_VERSION.includes(lib)
);

export { CURL, CIPHERS, SUPPORTS_HTTP2, SUPPORTS_HTTP3, SUPPORTS_CIPHERS_ARGS };
