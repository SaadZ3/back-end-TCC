import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { classifyPercentage, normalizeStoredResult } from '../src/utils/scoreScale.js';
import { evaluationSchema } from '../src/contracts/analysis.js';
import { inferenceResponseSchema } from '../src/contracts/analysis.js';

const fixture = (name: string) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

for (const [percentage, grade] of [[0,0],[1,0],[3,0],[25,0],[25.001,1],[26,1],[50,1],[50.001,2],[51,2],[75,2],[75.001,3],[76,3],[100,3]]) {
  test(`converte ${percentage}% em nota ${grade}`, () => assert.equal(classifyPercentage(percentage!), grade));
}

test('recusa percentuais fora do intervalo e não finitos', () => {
  for (const value of [-1, 101, NaN, Infinity]) assert.throws(() => classifyPercentage(value));
});

test('resíduos numéricos nos limites não alteram a nota', () => {
  for (const [limit, grade] of [[25, 0], [50, 1], [75, 2]]) {
    for (const delta of [-1e-13, 0, 1e-13]) {
      assert.equal(classifyPercentage(limit! + delta), grade);
    }
    assert.equal(classifyPercentage(limit! + 1e-10), grade! + 1);
  }
  const points = [2, 1.5, 1, .5, 1, 1, 0];
  const percentage = points.reduce((sum, value) => sum + 50 * value / 7, 0);
  assert.equal(classifyPercentage(percentage), 1);
});

test('conversão preserva o resultado salvo e não se repete', () => {
  const saved = fixture('legacy/documentary.json');
  const original = structuredClone(saved);
  const result = normalizeStoredResult(saved.result);
  const parsed = inferenceResponseSchema.parse({ ...saved, result });
  assert.deepEqual(saved, original);
  assert.deepEqual(normalizeStoredResult(result), result);
  assert.equal(parsed.result.evaluation.score_scale, 'ordinal_0_3');
  assert.equal(parsed.result.evaluation.score, classifyPercentage(original.result.evaluation.score));
  assert.deepEqual(parsed.result.segments, saved.result.segments);
});

test('percentual baixo não é confundido com uma nota convertida', () => {
  const result = normalizeStoredResult({ evaluation: { score: 3, dimensions: [] } });
  assert.equal((result as {evaluation: {score: number}}).evaluation.score, 0);
});

test('histórico parcial preserva nulos e converte somente notas existentes', () => {
  const saved = fixture('legacy/documentary.json');
  saved.result.document_scope = 'excerpt';
  const e = saved.result.evaluation;
  e.score = null; e.input_status = 'partial_input'; e.score_status = 'blocked';
  e.score_blockers = ['document_scope_incomplete'];
  e.dimensions.forEach((d: {contribution: number | null}) => { d.contribution = null; });
  const parsed = inferenceResponseSchema.parse({ ...saved, result: normalizeStoredResult(saved.result) });
  assert.equal(parsed.result.evaluation.score, null);
  assert.ok(parsed.result.evaluation.dimensions.every(d => d.contribution === null && d.score === 3));
});

test('contratos novos recusam escala ausente, desconhecida, notas fracionárias e percentuais antigos', () => {
  const e = fixture('e4/complete.json').result.evaluation;
  for (const value of [-1, 1.5, 4, 25, 100]) {
    assert.equal(evaluationSchema.safeParse({ ...e, score: value }).success, false);
  }
  for (const scale of [undefined, 'percentage', 'unknown']) {
    assert.equal(evaluationSchema.safeParse({ ...e, score_scale: scale }).success, false);
  }
  for (const score of [0, 1, 2, 3]) assert.equal(evaluationSchema.safeParse({ ...e, score }).success, true);
  const source = fixture('e4/complete.json');
  for (const value of [-1, 1.5, 4, 100]) {
    const changed = structuredClone(source);
    changed.result.evaluation.dimensions[0].score = value;
    assert.equal(inferenceResponseSchema.safeParse(changed).success, false);
  }
});
