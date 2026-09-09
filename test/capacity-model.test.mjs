import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, optimalPlan } from '../src/lib/capacity-model.ts';

// Reference values below are the ACTUAL printed output of running
// prefab_capacity_certainty_model.py's own __main__ block and optimal_plan()
// directly (python3 prefab_capacity_certainty_model.py; python3 -c "from
// prefab_capacity_certainty_model import optimal_plan; print(optimal_plan(220, 0.5))"),
// not hand-computed or assumed -- this is the real parity check the plan
// requires: the TS port must reproduce the Python source's own numbers.

test('evaluate(220) at theta=0.5 matches the Python reference sweep row', () => {
  const e = evaluate(220);
  assert.ok(Math.abs(e.base.margin - 0.168) < 0.001, `base.margin=${e.base.margin}`);
  assert.ok(Math.abs(e.Emargin - 0.161) < 0.001, `Emargin=${e.Emargin}`);
  assert.ok(Math.abs(e.p10 - 0.120) < 0.001, `p10=${e.p10}`);
  assert.ok(Math.abs(e.base.CTd - 29.3) < 0.05, `base.CTd=${e.base.CTd}`);
  assert.ok(Math.abs(e.ECT - 30.4) < 0.05, `ECT=${e.ECT}`);
  assert.ok(Math.abs(e.pLate - 0.16) < 0.001, `pLate=${e.pLate}`);
  assert.ok(Math.abs(e.Esub - 0.0) < 0.01, `Esub=${e.Esub}`);
});

test('optimalPlan(220, 0.5) matches the Python reference best plan and curve', () => {
  const { best, curve } = optimalPlan(220, 0.5);
  assert.equal(best.D, 230);
  assert.ok(Math.abs(best.Em - 21_198_094.72) < 1, `best.Em=${best.Em}`);
  assert.ok(Math.abs(best.Sv - 0.96) < 0.001, `best.Sv=${best.Sv}`);

  assert.equal(curve.length, 176);
  const [D0, Em0, Sv0] = curve[0];
  assert.equal(D0, 15);
  assert.ok(Math.abs(Em0 - -3_136_772.09) < 1, `curve[0].Em=${Em0}`);
  assert.equal(Sv0, 0);

  const last = curve[curve.length - 1];
  assert.equal(last[0], 320);
  assert.ok(Math.abs(last[1] - 15_157_563.40) < 1, `curve[last].Em=${last[1]}`);
});

test('optimalPlan is deterministic (no RNG) -- two calls with the same inputs agree exactly', () => {
  const run1 = optimalPlan(220, 0.5);
  const run2 = optimalPlan(220, 0.5);
  assert.deepEqual(run1.best, run2.best);
  assert.deepEqual(run1.curve, run2.curve);
});
