import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inferenceResponseSchema, analysisResponseSchema } from '../src/contracts/analysis.js';

const sample=(name='unicode')=>JSON.parse(readFileSync(path.join(__dirname,'fixtures/e5',name+'.json'),'utf8'));
for(const name of ['complete','partial','conflict','truncated','empty','unicode','practice'])
  test('E5 preserva recomendações e fontes Python: '+name,()=>{
    const source=sample(name);
    assert.deepEqual(inferenceResponseSchema.parse(source),source);
    const saved={...source,status:'completed',error:null,analysis_id:'00000000-0000-4000-8000-000000000001',
      created_at:'2026-09-28T12:00:00Z',original_filename:'e5.txt',profile_id:'core-14-v1',supersedes_analysis_id:null};
    assert.deepEqual(analysisResponseSchema.parse(saved),saved);
  });

for(const change of ['orphan','reverse','duplicate','priority','version','null_catalog','no_source','fake_standard','page','unsafe_url','unknown_field'])
  test('E5 rejeita recomendação inválida: '+change,()=>{
    const source=sample(),e=source.result.evaluation,r=e.recommendations[0];
    if(change==='orphan') r.finding_ids=['missing'];
    if(change==='reverse') e.findings.find((f:{id:string})=>f.id===r.finding_ids[0]).recommendation_ids=[];
    if(change==='duplicate') e.recommendations.push(structuredClone(r));
    if(change==='priority') r.priority=r.priority==='high'?'low':'high';
    if(change==='version') r.catalog_version='different:'+'0'.repeat(64);
    if(change==='null_catalog') source.versions.recommendations=null;
    if(change==='no_source') r.references=[];
    if(change==='fake_standard') r.references[0].source_type='standard';
    if(change==='page') r.references[0].pdf_page=99;
    if(change==='unsafe_url') r.references[0].url='javascript:alert(1)';
    if(change==='unknown_field') r.references[0].unverified_extra='must not vanish';
    assert.equal(inferenceResponseSchema.safeParse(source).success,false);
  });
