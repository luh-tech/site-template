// The generated venture directory is valid TypeScript and names every venture a crossLink may carry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VENTURE_DIRECTORY } from '../src/lib/venture-directory.generated.ts';
import { VENTURES } from '../bin/lib/ventures.mjs';

test('the generated directory loads and has an entry for every venture with a brand file', () => {
  for (const v of VENTURES) {
    assert.ok(VENTURE_DIRECTORY[v.id]?.name, `${v.id} has no display name`);
  }
});

test('a hyphenated id resolves to its brand name, not its slug', () => {
  assert.equal(VENTURE_DIRECTORY['luhtech-business'].name, 'LuhTech');
});
