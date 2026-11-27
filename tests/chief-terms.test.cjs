const test = require('node:test');
const assert = require('node:assert/strict');
const context = {window:{}};
require('node:vm').runInNewContext(
  require('node:fs').readFileSync(require('node:path').join(__dirname,'../chief-terms.js'),'utf8'),
  context
);

test('a chief term counts Moscow days and changes color at 15 and 7 remaining', () => {
  const { describe } = context.window.PoliceChiefTerms;
  for (const [now, remaining, stage] of [
    ['2026-11-01T00:00:00+03:00',30,'early'],
    ['2026-11-16T00:00:00+03:00',15,'middle'],
    ['2026-11-24T00:00:00+03:00',7,'late'],
    ['2026-12-01T00:00:00+03:00',0,'late'],
  ]) {
    const term = describe('2026-11-01',new Date(now));
    assert.equal(term.remaining,remaining);
    assert.equal(term.stage,stage);
  }
  assert.equal(describe('2026-11-01',new Date('2026-11-23T20:59:00Z')).remaining,8);
  assert.equal(describe('2026-11-01',new Date('2026-12-10T00:00:00Z')).elapsed,39);
  assert.equal(describe('2026-02-29'),null);
  assert.ok(context.window.PoliceChiefTerms.sameNickname('Johnny Nelson','Johnny_Nelson'));
});

assert.equal(context.window.PoliceChiefTerms.dateForElapsed(14,new Date('2026-11-27T12:00:00+03:00')),'2026-11-13');
