const fs = require('fs');
const path = require('path');

const build = process.env.SPA_BUILD || path.join(__dirname, '..', 'build');
const required = [
  'agents/index.html',
  'agent-skill/index.html',
  'skill.md',
  'agent-skill/SKILL.md',
];
const missing = required.filter((file) => !fs.existsSync(path.join(build, file)));

if (missing.length > 0) {
  console.error('verify-agent-build: missing', missing.join(', '));
  process.exit(1);
}

console.log('verify-agent-build: found', required.join(', '));
