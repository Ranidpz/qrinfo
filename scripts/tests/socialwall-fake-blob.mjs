// Minimal fake Vercel Blob API for scripts/tests/socialwall.e2e.mjs (PUT upload, POST /delete,
// GET /files/*, GET /__count). Point @vercel/blob at it with VERCEL_BLOB_API_URL.
import http from 'node:http';
const files = new Map();
http.createServer((req, res) => {
  let chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const u = new URL(req.url, 'http://127.0.0.1:4555');
    if (req.method === 'PUT') {
      const pathname = u.searchParams.get('pathname') || u.pathname.slice(1);
      files.set(pathname, Buffer.concat(chunks));
      const url = `http://127.0.0.1:4555/files/${pathname}`;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ url, downloadUrl: url + '?download=1', pathname, contentType: req.headers['x-content-type'] || 'application/octet-stream', contentDisposition: 'inline' }));
      return;
    }
    if (req.method === 'POST' && u.pathname === '/delete') {
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      for (const url of body.urls || []) files.delete(new URL(url).pathname.replace('/files/', ''));
      res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return;
    }
    if (u.pathname === '/__count') { res.writeHead(200); res.end(String(files.size)); return; }
    if (u.pathname.startsWith('/files/')) { const f = files.get(decodeURIComponent(u.pathname.slice(7))); if (!f) { res.writeHead(404); res.end(); return; } res.writeHead(200); res.end(f); return; }
    res.writeHead(404); res.end();
  });
}).listen(4555, '127.0.0.1', () => console.log('fake blob on 4555'));
