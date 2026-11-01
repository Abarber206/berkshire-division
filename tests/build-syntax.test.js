// The built page is one big <script>: two files declaring the same top-level
// name (e.g. two `treesNear`s) is a SyntaxError that freezes the game on the menu.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('built index.html script parses (no duplicate top-level names)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length > 0);
  for (const s of scripts) assert.doesNotThrow(() => new vm.Script(s), 'built script must parse');
});
