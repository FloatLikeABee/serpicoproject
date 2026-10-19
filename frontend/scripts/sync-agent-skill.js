const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const canonical = path.join(publicDir, 'skill.md');
const legacy = path.join(publicDir, 'agent-skill', 'SKILL.md');

fs.copyFileSync(canonical, legacy);
