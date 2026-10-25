import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { analysisMetadataSchema, analysisResponseSchema, inferenceResponseSchema } from '../src/contracts/analysis.js';

const fixture = (name: string) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures/e4',name+'.json'), 'utf8'));
for (const name of ['complete','partial','conflict','truncated','empty','unicode']) test('preserva integralmente saída Python: '+name, () => {
  const source = fixture(name);
  assert.deepEqual(inferenceResponseSchema.parse(source), source);
  const envelope = { ...source, status: 'completed', error: null, analysis_id: '00000000-0000-4000-8000-000000000001',
    created_at: '2026-09-27T12:00:00Z', original_filename: 'fixture.txt', supersedes_analysis_id: null, profile_id: 'core-14-v1' };
  assert.deepEqual(analysisResponseSchema.parse(envelope), envelope);
});
for (const name of ['score','contribution','value','quote','offset','missing','discarded','applicability','profile','blockers','weight','provenance','rule'])
  test('rejeita incoerência: '+name, () => {
    const source = fixture('complete');
    const e = source.result.evaluation, d = e.dimensions[0], q = d.questions[0];
    if (name === 'score') e.score = 0;
    if (name === 'contribution') d.contribution = null;
    if (name === 'value') q.value = 0;
    if (name === 'quote') q.supporting_groups[0].evidence[0].quote = 'fabricada';
    if (name === 'offset') source.result.segments[0].char_start++;
    if (name === 'missing') delete q.duplicate_occurrences_omitted;
    if (name === 'discarded') e.field_that_must_not_disappear = 'unknown';
    if (name === 'applicability') q.applicability.state = 'unknown';
    if (name === 'profile') e.profile_id = 'custom';
    if (name === 'blockers') e.score_blockers = ['inconclusive_questions'];
    if (name === 'weight') d.normalized_weight = 0;
    if (name === 'provenance') q.supporting_groups[0].detection_source = 'model_and_rule';
    if (name === 'rule') q.rule_version = 'different';
    });
test('aceita documento inteiro com extração parcial e preserva o bloqueio da nota', () => {
  const source = fixture('partial');
  source.result.document_scope = 'full_document';
  source.result.extraction.status = 'partial';
  source.result.evaluation.score_blockers = ['extraction_partial'];
  assert.deepEqual(inferenceResponseSchema.parse(source), source);
  assert.equal(source.result.evaluation.score, null);
  const envelope = { ...source, status: 'completed', error: null,
    analysis_id: '00000000-0000-4000-8000-000000000001', created_at: '2026-09-27T12:00:00Z',
    original_filename: 'partial.pdf', supersedes_analysis_id: null, profile_id: 'core-14-v1' };
  assert.deepEqual(analysisResponseSchema.parse(envelope), envelope);
  source.result.evaluation.score_blockers.unshift('document_scope_incomplete');
  assert.equal(inferenceResponseSchema.safeParse(source).success, false);
});

test('rejeita exclusões arbitrárias, autor e campo extra no upload', () => {
  const valid = { language: 'pt', document_scope: 'unknown' };
  assert.deepEqual(analysisMetadataSchema.parse(valid), valid);
  for (const extra of [{ applicability: { collection: false } }, { user_id: 'other' }, { profile_id: 'unknown' }])
    assert.equal(analysisMetadataSchema.safeParse({ ...valid,...extra }).success, false);
});
test('mantém discriminador e perfil durante processamento/falha', () => {
  const base = { schema_version: 2, analysis_id: '00000000-0000-4000-8000-000000000001', created_at: '2026-09-27T12:00:00Z',
    original_filename: 'file.txt', profile_id: 'core-14-v1', supersedes_analysis_id: null, result: null, versions: null };
  assert.equal(analysisResponseSchema.parse({ ...base, status:'processing', error:null }).schema_version, 2);
  assert.equal(analysisResponseSchema.parse({ ...base, status:'failed', error: { code:'ANALYSIS_TIMEOUT', message:'Timeout' } }).schema_version, 2);
});
