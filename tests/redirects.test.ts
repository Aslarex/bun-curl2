import { test, expect } from 'bun:test';
import BunCurl2, { ResponseInit } from '../src';

type Equals<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false;

type Expect<T extends true> = T;

const clientWithRedirectUrls = new BunCurl2({
  redirectsAsUrls: true,
});

const clientWithRedirectObjects = new BunCurl2({
  redirectsAsUrls: false,
});

test('redirects test', async () => {
  const desiredChainForUrls = [
    'https://httpbingo.org/relative-redirect/2',
    'https://httpbingo.org/relative-redirect/1',
    'https://httpbingo.org/get',
  ];

  const urls = await clientWithRedirectUrls.get(
    'https://httpbingo.org/redirect/3',
  );

  // @ts-check
  type isStrArray = Expect<Equals<(typeof urls)['redirects'], string[]>>; // Must have a type of: true

  expect(urls.redirects).toBeArrayOfSize(3);
  expect(urls.redirects).toMatchObject(desiredChainForUrls);

  // For full-response objects, url must preserve the initial request URL instead of the redirect URL
  // As we can still see the redirect URL in "location" header :)

  const desiredChainForObjects = [
    'https://httpbingo.org/redirect/3',
    'https://httpbingo.org/relative-redirect/2',
    'https://httpbingo.org/relative-redirect/1',
  ];

  const objects = await clientWithRedirectObjects.get(
    'https://httpbingo.org/redirect/3',
  );

  // @ts-check
  type isResponseInitArray = Expect<
    Equals<(typeof objects)['redirects'], ResponseInit<any, false>[]>
  >; // Must have a type of: true

  expect(objects.redirects).toBeArrayOfSize(3);
  expect(
    objects.redirects.map((e) => ((e satisfies ResponseInit) ? e.url : 0)),
  ).toMatchObject(desiredChainForObjects);
});
