import { createServer } from 'node:http';
import { open, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const defaultPublicDirectory = fileURLToPath(new URL('./public/', import.meta.url));
const contentTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function respond(response, method, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(method === 'HEAD' ? undefined : body);
}

export function createAppServer({ publicDirectory = defaultPublicDirectory } = {}) {
  return createServer(async (request, response) => {
    const { method } = request;
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ].join('; '));
    response.setHeader('Cache-Control', 'no-cache');

    if (method !== 'GET' && method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      respond(response, method, 405, 'Method not allowed\n');
      return;
    }

    let path;
    try {
      path = decodeURIComponent(request.url.split('?', 1)[0]);
    } catch {
      respond(response, method, 400, 'Malformed URL\n');
      return;
    }

    const segments = path.split('/').slice(1);
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x1f\x7f]/u.test(path)
      || segments.some(segment => segment.startsWith('.'))) {
      respond(response, method, 400, 'Invalid path\n');
      return;
    }

    try {
      const root = await realpath(publicDirectory);

      if (path === '/healthz') {
        const index = await stat(resolve(root, 'index.html'));
        if (!index.isFile()) {
          respond(response, method, 503, '{"status":"unavailable"}\n', contentTypes['.json']);
          return;
        }
        respond(response, method, 200, '{"status":"ok"}\n', contentTypes['.json']);
        return;
      }

      const filename = await realpath(resolve(root, path === '/' ? 'index.html' : segments.join('/')));
      const relativePath = relative(root, filename);
      if (!relativePath || isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
        respond(response, method, 404, 'Not found\n');
        return;
      }

      const metadata = await stat(filename);
      const contentType = contentTypes[extname(filename).toLowerCase()];
      if (!metadata.isFile() || !contentType) {
        respond(response, method, 404, 'Not found\n');
        return;
      }

      if (method === 'HEAD') {
        response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': metadata.size });
        response.end();
        return;
      }

      const file = await open(filename);
      response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': metadata.size });
      await pipeline(file.createReadStream(), response);
    } catch (error) {
      if (response.destroyed) return;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (path === '/healthz') {
        respond(response, method, 503, '{"status":"unavailable"}\n', contentTypes['.json']);
        return;
      }
      if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes(error.code)) {
        respond(response, method, 404, 'Not found\n');
        return;
      }
      console.error('Failed to serve public file', error);
      respond(response, method, 500, 'Internal server error\n');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8080);
  const server = createAppServer();
  server.listen(port, host, () => {
    console.log(`YOSORA is listening on ${host}:${server.address().port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(error => {
        if (error) {
          console.error(error);
          process.exitCode = 1;
        }
      });
    });
  }
}
