export interface TechnicalSeoFixturePage {
  status: number;
  headers?: Record<string, string>;
  body: string;
}

export const technicalSeoFixturePages: Record<string, TechnicalSeoFixturePage> = {
  "/static": {
    status: 200,
    body: "<!doctype html><html lang='en'><head><title>Static Fixture</title><meta name='description' content='A deterministic static page.'><link rel='canonical' href='https://fixture.example/static'></head><body><main><h1>Static fixture</h1><p>This fixture has server-rendered content for repeatable scanner tests.</p><a href='/about'>About</a></main></body></html>",
  },
  "/js-content": {
    status: 200,
    body: "<!doctype html><html><head><title>JS Fixture</title></head><body><main id='content'></main><script>document.querySelector('#content').innerHTML='<h1>Rendered heading</h1><p>'+('Rendered content '.repeat(60))+'</p>'</script></body></html>",
  },
  "/js-remove-content": {
    status: 200,
    body: `<!doctype html><html><head><title>Removal Fixture</title></head><body><main id="content"><h1>Initial content</h1><p>${"Meaningful server content ".repeat(60)}</p></main><script>document.querySelector('#content').remove()</script></body></html>`,
  },
  "/noindex": { status: 200, body: "<!doctype html><html><head><title>Noindex</title><meta name='robots' content='noindex,follow'></head><body><h1>Noindex fixture</h1></body></html>" },
  "/canonical-conflict": { status: 200, body: "<!doctype html><html><head><title>Canonical conflict</title><link rel='canonical' href='/one'><link rel='canonical' href='/two'></head><body><h1>Conflict</h1></body></html>" },
  "/malformed-schema": { status: 200, body: "<!doctype html><html><head><title>Schema</title><script type='application/ld+json'>{not valid json}</script></head><body><h1>Schema fixture</h1></body></html>" },
  "/not-found": { status: 404, body: "<!doctype html><html><head><title>Not found</title></head><body><h1>Not found</h1></body></html>" },
  "/redirect": { status: 302, headers: { location: "/static" }, body: "" },
  "/redirect-loop": { status: 302, headers: { location: "/redirect-loop" }, body: "" },
  "/redirect-private": { status: 302, headers: { location: "http://127.0.0.1/admin" }, body: "" },
  "/robots.txt": { status: 200, body: "User-agent: Googlebot\nDisallow: /blocked\nAllow: /\nSitemap: https://fixture.example/sitemap.xml\n" },
  "/sitemap.xml": { status: 200, headers: { "content-type": "application/xml" }, body: "<?xml version='1.0'?><urlset><url><loc>https://fixture.example/static</loc></url></urlset>" },
};

export function oversizedTechnicalSeoFixture(): TechnicalSeoFixturePage {
  return { status: 200, body: `<html><body>${"x".repeat(2_100_000)}</body></html>` };
}
