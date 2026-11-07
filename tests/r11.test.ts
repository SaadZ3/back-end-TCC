/** Verifica o contrato v3 sem aceitar notas ou achados de temas desmarcados. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analysisMetadataSchema, analysisResponseSchema, inferenceResponseSchema} from '../src/contracts/analysis.js';
const load=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/r11/${name}.json`,import.meta.url),'utf8'));
for(const name of ['all','one','two','three','excluded','all-inconclusive','excerpt','unknown','empty','truncated']) test(`R11 valida ${name}`,()=>{
  const value=load(name);assert.deepEqual(inferenceResponseSchema.parse(value),value);
});
for(const [name,mutate] of [
  ['seleção omitida',(v:any)=>{delete v.result.evaluation.assessment_scope;}],
  ['categorias vazias',(v:any)=>{v.result.evaluation.assessment_scope.category_ids=[];}],
  ['categoria repetida',(v:any)=>{v.result.evaluation.assessment_scope.category_ids.push('security');}],
  ['modo todas com subconjunto',(v:any)=>{v.result.evaluation.assessment_scope.mode='all_categories';}],
  ['nota em categoria desmarcada',(v:any)=>{v.result.evaluation.dimensions[0].score=3;}],
  ['categoria desmarcada tratada como dúvida',(v:any)=>{v.result.evaluation.dimensions[0].status='unresolved';}],
  ['peso errado',(v:any)=>{v.result.evaluation.dimensions[5].normalized_weight=1/9;}],
  ['versão antiga com seleção',(v:any)=>{v.schema_version=2;}],
] as const)test(`R11 rejeita ${name}`,()=>{const v=load('two');mutate(v);assert.equal(inferenceResponseSchema.safeParse(v).success,false);});
test('seleção do upload valida JSON, IDs e duplicatas',()=>{
  const data={language:'pt',document_scope:'full_document'};
  for(const value of ['null','[]','{}','not json',JSON.stringify({mode:'selected_categories',category_ids:['Other']})])
    assert.equal(analysisMetadataSchema.safeParse({...data,assessment_scope:value}).success,false);
  assert.equal(analysisMetadataSchema.safeParse({...data,assessment_scope:JSON.stringify({mode:'selected_categories',category_ids:['security']})}).success,true);
});
test('seleção persistida acompanha processamento, falha e resultado',()=>{
  const value=load('two');const scope=value.result.evaluation.assessment_scope;
  const common={schema_version:3,analysis_id:'621936f9-d554-48c8-93fb-7c96daa9ef31',original_filename:'r11.txt',created_at:'2026-11-06T12:00:00Z',supersedes_analysis_id:null,profile_id:'documentary-18-v1',assessment_scope:scope};
  assert.equal(analysisResponseSchema.safeParse({...common,status:'processing',versions:null,result:null,error:null}).success,true);
  assert.equal(analysisResponseSchema.safeParse({...common,status:'failed',versions:null,result:null,error:{code:'INFERENCE_UNAVAILABLE',message:'Indisponível'}}).success,true);
  const complete={...value,...common,status:'completed',error:null};
  assert.equal(analysisResponseSchema.safeParse(complete).success,true);
  complete.assessment_scope={mode:'selected_categories',category_ids:['security']};
  assert.equal(analysisResponseSchema.safeParse(complete).success,false);
});
