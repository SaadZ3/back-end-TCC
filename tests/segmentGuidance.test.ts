import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { analysisResponseSchema, inferenceResponseSchema } from '../src/contracts/analysis.js';

for (const name of ['local', 'complement', 'conflict', 'unicode', 'complete']) {
  test('preserva recomendações por pergunta e evidências: ' + name, () => {
    const source = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/segment-guidance', name + '.json'), 'utf8'));
    assert.deepEqual(inferenceResponseSchema.parse(source), source);
    const envelope = { ...source, status: 'completed', error: null, analysis_id: '00000000-0000-4000-8000-000000000001',
      created_at: '2026-10-18T12:00:00Z', original_filename: 'fixture.txt', supersedes_analysis_id: null, profile_id: 'core-14-v1' };
    assert.deepEqual(analysisResponseSchema.parse(envelope), envelope);
  });
}
