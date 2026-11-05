/** Confere exclusões, pesos redistribuídos e leitura do histórico na R9. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { inferenceResponseSchema } from '../src/contracts/analysis.js';

const load = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/r9/${name}.json`, import.meta.url), 'utf8'));
for (const name of ['complete', 'partial', 'conflict', 'truncated', 'empty', 'unicode', 'independent', 'all-inconclusive']) {
  test(`R9 preserva resposta, evidências e cálculo: ${name}`, () => {
    const source=load(name);
    assert.deepEqual(inferenceResponseSchema.parse(source),source);
  });
}
for (const filename of readdirSync(new URL('../../docs/evidencias/R9/politicas/', import.meta.url)).filter(n=>n.startsWith('resultado-'))) {
  test(`R9 valida estudo real: ${filename}`,()=>{
    const source=JSON.parse(readFileSync(new URL(`../../docs/evidencias/R9/politicas/${filename}`,import.meta.url),'utf8'));
    assert.deepEqual(inferenceResponseSchema.parse(source),source);
  });
}
for (const [name, mutate] of [
  ['peso de categoria excluída', (e: any)=>{e.dimensions[0].normalized_weight=1/7;}],
  ['denominador incorreto', (e: any)=>{e.dimensions[0].excluded_questions=0;}],
  ['nota em categoria excluída', (e: any)=>{e.dimensions[0].score=0;}],
  ['bloqueio antigo', (e: any)=>{e.score_blockers=['inconclusive_questions'];e.score=null;e.score_status='blocked';}],
  ['método sem política de incerteza', (e: any)=>{delete e.uncertainty_policy;}],
] as const) test(`R9 rejeita ${name}`,()=>{
  const source=load('conflict'); mutate(source.result.evaluation);
  assert.equal(inferenceResponseSchema.safeParse(source).success,false);
});
test('R9 rejeita evidência duvidosa reaproveitada como suporte',()=>{
  const source=load('independent');
  const q=source.result.evaluation.dimensions[0].questions[0];
  q.supporting_groups.push(q.contextual_groups[0]);
  assert.equal(inferenceResponseSchema.safeParse(source).success,false);
});
