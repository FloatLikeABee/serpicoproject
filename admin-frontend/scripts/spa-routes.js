const fs = require('fs');
const path = require('path');

/** Copy index.html to SPA client routes so static hosts return HTTP 200 without _redirects. */
const build = path.join(__dirname, '..', 'build');
const indexSrc = path.join(build, 'index.html');
if (!fs.existsSync(indexSrc)) {
  console.error('spa-routes: missing', indexSrc);
  process.exit(1);
}
const html = fs.readFileSync(indexSrc);
const routes = ['login', 'hardware', 'rag-training', 'data-collection'];
for (const route of routes) {
  const dir = path.join(build, route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(build, `${route}.html`), html);
}
fs.copyFileSync(indexSrc, path.join(build, '404.html'));
console.log('spa-routes: wrote', routes.map((r) => r + '/index.html').join(', '), 'and 404.html');
