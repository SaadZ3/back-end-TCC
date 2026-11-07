/** Confere o perfil ampliado e recusa resultados que misturam as duas versões. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { inferenceResponseSchema, analysisResponseSchema } from '../src/contracts/analysis.js';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/r10/${name}.json`, import.meta.url), 'utf8'));
for (const name of ['complete', 'partial', 'conflict', 'truncated', 'empty', 'unicode', 'nine-supported', 'negative-dnt', 'dnt-conflict']) {
  test(`R10 valida notas, evidências e recomendações: ${name}`, () => {
    const value = load(name);
    assert.deepEqual(inferenceResponseSchema.parse(value), value);
    assert.equal(value.result.evaluation.dimensions.length, 9);
  });
}
for (const filename of readdirSync(new URL('../../docs/evidencias/R10/politicas/', import.meta.url)).filter(n => n.startsWith('resultado-'))) {
  test(`R10 valida política reavaliada: ${filename}`, () => {
    const value = JSON.parse(readFileSync(new URL(`../../docs/evidencias/R10/politicas/${filename}`, import.meta.url), 'utf8'));
    assert.deepEqual(inferenceResponseSchema.parse(value), value);
  });
}
for (const [name, mutate] of [
  ['perfil antigo com 18 perguntas', (e: any) => { e.profile_id = 'core-14-v1'; }],
  ['método antigo com perfil novo', (e: any) => { e.method_version = 'documentary-quality-v4-draft1'; }],
  ['pergunta ausente', (e: any) => { e.dimensions[7].questions.pop(); }],
  ['categoria ausente', (e: any) => { e.dimensions.pop(); }],
  ['pergunta de outra categoria', (e: any) => { e.dimensions[7].questions[0].id = 'audiences.scope'; }],
  ['peso antigo', (e: any) => { e.dimensions[7].normalized_weight = 1 / 7; }],
  ['dúvida reaproveitada', (e: any) => { const q = e.dimensions[7].questions[0]; q.supporting_groups.push(q.contextual_groups[0]); }],
] as const) test(`R10 rejeita ${name}`, () => {
  const value = load('dnt-conflict'); mutate(value.result.evaluation);
  assert.equal(inferenceResponseSchema.safeParse(value).success, false);
});
test('R10 exige perfil persistido igual ao perfil do resultado', () => {
  const response = { ...load('nine-supported'), status: 'completed', error: null,
    analysis_id: '621936f9-d554-48c8-93fb-7c96daa9ef31', created_at: '2026-11-06T12:00:00Z',
    original_filename: 'exemplo.txt', supersedes_analysis_id: null, profile_id: 'documentary-18-v1' };
  assert.equal(analysisResponseSchema.safeParse(response).success, true);
  response.profile_id = 'core-14-v1';
  assert.equal(analysisResponseSchema.safeParse(response).success, false);
});
