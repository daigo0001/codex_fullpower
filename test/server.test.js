import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createAppServer } from '../server.js';

const html = '<!doctype html><title>夜空</title>\n';
let directory;
let server;
let origin;

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'yosora-server-'));
  const publicDirectory = join(directory, 'public');
  await mkdir(join(publicDirectory, 'js'), { recursive: true });
  await writeFile(join(publicDirectory, 'index.html'), html);
  await writeFile(join(publicDirectory, 'js', 'app.js'), 'export const sky = true;\n');
  await writeFile(join(directory, 'private.html'), '<p>private</p>');
  await symlink(join(directory, 'private.html'), join(publicDirectory, 'escape.html'));

  server = createAppServer({ publicDirectory });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (directory) await rm(directory, { recursive: true, force: true });
});

function rawStatus(path) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves the page and client modules with their content types', async () => {
  const page = await fetch(`${origin}/`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await page.text(), html);

  const module = await fetch(`${origin}/js/app.js?version=1`);
  assert.equal(module.status, 200);
  assert.equal(module.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.match(await module.text(), /export const sky/);
});

test('reports readiness and handles HEAD without a body', async () => {
  const health = await fetch(`${origin}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const page = await fetch(`${origin}/`, { method: 'HEAD' });
  assert.equal(page.status, 200);
  assert.equal(Number(page.headers.get('content-length')), Buffer.byteLength(html));
  assert.equal(await page.text(), '');
});

test('rejects unsupported methods, paths that escape public, and unknown assets', async () => {
  const post = await fetch(`${origin}/`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  await post.text();

  assert.equal(await rawStatus('/%2e%2e/private.html'), 400);
  assert.equal(await rawStatus('/%5c../private.html'), 400);
  assert.equal(await rawStatus('/%zz'), 400);
  assert.equal(await rawStatus('/escape.html'), 404);
  assert.equal(await rawStatus('/missing.png'), 404);
});
