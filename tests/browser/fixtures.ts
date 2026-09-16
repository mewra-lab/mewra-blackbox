import { createServer } from 'node:http';
export async function fixtures() {
  let forbiddenHits = 0;
  let variant = false;
  let unapprovedRouteHits = 0;
  const forbidden = createServer((_req, res) => {
    forbiddenHits++;
    res.end('Forbidden origin');
  });
  await new Promise<void>((r) => forbidden.listen(0, '127.0.0.1', r));
  const f = forbidden.address() as { port: number };
  const server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { location: `http://127.0.0.1:${f.port}/` }).end();
      return;
    }
    if (req.url === '/slow') {
      return;
    }
    if (req.url === '/same-redirect') {
      res.writeHead(302, { location: '/unapproved' }).end();
      return;
    }
    if (req.url === '/frame') {
      res.setHeader('content-type', 'text/html');
      res.end('<h1>Hello</h1><iframe src="/same-redirect"></iframe>');
      return;
    }
    if (req.url === '/unapproved') {
      unapprovedRouteHits++;
      res.end('Unexpected');
      return;
    }
    if (req.url === '/download') {
      res
        .writeHead(200, {
          'content-disposition': 'attachment; filename="fixture.txt"',
        })
        .end('synthetic fixture');
      return;
    }
    res.setHeader('content-type', 'text/html');
    res.end(
      `<!doctype html><html><head><link rel="icon" href="data:,"><style>body{font-family:Arial;background:${variant ? 'pink' : 'white'};color:black}h1{font-size:24px}@media(max-width:500px){h1{font-size:20px}}</style></head><body><h1>Hello</h1><label for="name">Name</label><input id="name"><label for="password">Password</label><input type="password" id="password"><label for="plan">Plan</label><select id="plan"><option value="basic">Basic</option><option value="pro">Pro</option></select><button onclick="document.querySelector('[data-testid=result]').textContent='Saved'">Save</button><p data-testid="result">Ready</p><div data-testid="dynamic">Fixed fixture</div><a href="/redirect">Redirect</a><button onclick="window.open('/','popup')">Popup</button><script>console.log('synthetic-secret-console');${req.url === '/state' ? "document.querySelector('[data-testid=result]').textContent=(document.cookie||localStorage.getItem('prior'))?'Leaked':'Fresh';document.cookie='session=synthetic';localStorage.setItem('prior','synthetic');" : ''}</script>${req.url === '/external' ? `<img src="http://127.0.0.1:${f.port}/image"><iframe src="http://127.0.0.1:${f.port}/frame"></iframe>` : ''}</body></html>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const a = server.address() as { port: number };
  return {
    origin: `http://127.0.0.1:${a.port}`,
    forbiddenHits: () => forbiddenHits,
    unapprovedRouteHits: () => unapprovedRouteHits,
    variant: (value: boolean) => {
      variant = value;
    },
    close: async () => {
      server.closeAllConnections();
      forbidden.closeAllConnections();
      await Promise.all([
        new Promise<void>((r) => server.close(() => r())),
        new Promise<void>((r) => forbidden.close(() => r())),
      ]);
    },
  };
}
