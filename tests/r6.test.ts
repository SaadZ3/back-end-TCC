/** Confere o contrato novo, o histórico e a ligação das orientações. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inferenceResponseSchema } from '../src/contracts/analysis.js';
import { normalizeStoredResult } from '../src/utils/scoreScale.js';

const fixture = (name: string) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures/r6', name + '.json'), 'utf8'));

for (const name of ['complete', 'partial', 'conflict', 'truncated', 'empty', 'unicode', 'partial-credit', 'use-purpose', 'local']) {
  test('preserva notas e orientações da R6: ' + name, () => {
    const source = fixture(name);
    assert.deepEqual(inferenceResponseSchema.parse(source), source);
    const before = structuredClone(source.result);
    assert.deepEqual(normalizeStoredResult(source.result), before);
    assert.deepEqual(source.result, before);
  });
}

test('crédito parcial não desaparece na faixa zero', () => {
  const { result: { evaluation: e } } = inferenceResponseSchema.parse(fixture('partial-credit'));
  assert.equal(e.dimensions.find(d => d.id === 'access')!.score, .75);
  assert.ok(Math.abs(e.score! - .75 / 7) < 1e-12);
  assert.ok(e.recommendations.some(r => r.template_id === 'access.channel.policy_wording' && r.how_to_do.length && r.references.length));
});

test('nota, contribuição, escala ou conversão adulteradas são recusadas', () => {
  for (const kind of ['score', 'contribution', 'scale', 'conversion']) {
    const source = fixture('partial-credit');
    const e = source.result.evaluation;
    if (kind === 'score') e.dimensions[3].score = 0;
    if (kind === 'contribution') e.dimensions[3].contribution = 0;
    if (kind === 'scale') e.score_scale = 'ordinal_0_3';
    if (kind === 'conversion') e.score_conversion = 'percentage_to_ordinal_v1';
    assert.equal(inferenceResponseSchema.safeParse(source).success, false, kind);
  }
});

test('uso e finalidade sustentados não recebem recomendação de ausência', () => {
  const e = inferenceResponseSchema.parse(fixture('use-purpose')).result.evaluation;
  assert.equal(e.dimensions[0].score, 3);
  assert.ok(e.dimensions[0].questions.every(q => q.status === 'supported'));
  assert.ok(e.recommendations.every(r => !r.template_id.startsWith('collection.')));
});
