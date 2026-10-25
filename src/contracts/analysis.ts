import { z } from 'zod';
import { classifyPercentage } from '../utils/scoreScale.js';
import { metadataSchema, resultFields, apiErrorSchema, evidenceSchema, baseVersionsSchema } from './analysis.shared.js';
export { errorResponseSchema } from './analysis.shared.js';

const id = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative();
const score = z.number().int().min(0).max(3);
const contribution = z.number().min(0).max(3);
const fraction = z.number().min(0).max(1);
const catalogVersion = z.string().regex(/^[a-z0-9-]+:[a-f0-9]{64}$/);
const reference = z.strictObject({
  id, source_type: z.enum(['project_rubric', 'public_guidance']), title: id, edition: id.nullable(),
  section: id.nullable(), pdf_page: z.null(), url: z.url().refine(value => value.startsWith('https://')).nullable(),
  verified_by: id, verified_at: z.iso.date(), verification_scope: z.enum(['provided_workbook', 'project_document']),
  source_file: id, source_sha256: hash, source_locator: id, control_role: z.enum(['controller', 'processor', 'shared', 'project']), summary: id,
}).superRefine((r, ctx) => {
  if ((r.source_type === 'public_guidance' && (r.verification_scope !== 'provided_workbook' || !r.url || r.control_role === 'project')) ||
      (r.source_type === 'project_rubric' && (r.verification_scope !== 'project_document' || r.control_role !== 'project')))
    ctx.addIssue({code:'custom',message:'Origem da referência inconsistente.'});
});
const recommendation = z.strictObject({
  id, template_id: id, catalog_version: catalogVersion, finding_ids: z.array(id).min(1),
  target: z.enum(['policy_wording', 'organizational_verification']), trigger_reason: id,
  what_to_do: id, how_to_do: z.array(id).min(1), completion_evidence: z.array(id).min(1), suggested_role: id.nullable(),
  references: z.array(reference).min(1), pending_fields: z.array(id).min(1),
  priority: z.enum(['high', 'medium', 'low']), priority_reason: id, applicability_note: id,
});
const states = ['supported', 'partial', 'not_detected', 'inconclusive', 'not_applicable'] as const;
const questionIds = ['collection.data_types', 'collection.purposes', 'sharing.recipients', 'sharing.conditions',
  'choice.mechanism', 'choice.channel', 'access.channel', 'access.response_time', 'retention.duration',
  'retention.disposal', 'security.technical_measures', 'security.access_controls', 'changes.notice_channel', 'changes.notice_timing'];

export const analysisMetadataSchema = metadataSchema.extend({
  supersedes_analysis_id: z.uuid().optional(),
});
const group = z.strictObject({
  id, evidence: z.array(evidenceSchema.refine(e => e.end > e.start && e.quote.length > 0)).min(1).max(2),
  polarity: z.enum(['affirmed', 'negated', 'conditional', 'uncertain']),
  detection_source: z.enum(['model_and_rule', 'rule_only']), rule_id: id, rule_version: id, rationale: id,
});
const search = z.strictObject({ searched_segment_ids: z.array(id), excluded_segment_ids: z.array(id),
  category_pass: z.boolean(), fallback_pass: z.boolean(), fallback_reason: z.string().nullable() });
const question = z.strictObject({
  id, dimension_id: id, title: id, status: z.enum(states), value: z.union([z.literal(0), z.literal(.5), z.literal(1)]).nullable(),
  applicability: z.strictObject({ state: z.enum(['applicable', 'not_applicable', 'unknown']),
    source: z.enum(['profile', 'user']), source_id: id, reason: id, declared_at: z.iso.datetime({ offset: true }) }),
  rule_id: id, rule_version: id, rationale: id, found_elements: z.array(id), missing_elements: z.array(id),
  supporting_groups: z.array(group), contextual_groups: z.array(group), search_scope: search,
  finding_ids: z.array(id), duplicate_occurrences_omitted: count,
});
const dimension = z.strictObject({ id, title: id, weight: z.number().positive(), normalized_weight: fraction.nullable(),
  status: z.enum(['resolved', 'unresolved', 'not_applicable']), score: score.nullable(), contribution: contribution.nullable(),
  earned_points: z.number().nonnegative(), applicable_questions: count, unknown_applicability_questions: count,
  resolved_questions: count, inconclusive_questions: count, excluded_questions: count, questions: z.array(question),
});
const finding = z.strictObject({ id, dimension_id: id.nullable(), question_id: id.nullable(), rule_id: id, rule_version: id,
  kind: z.enum(['information_gap', 'ambiguity', 'contradiction', 'practice_statement', 'extraction_limitation']),
  title: id, rationale: id, priority: z.enum(['high', 'medium', 'low']), priority_reason: id,
  evidence_groups: z.array(group), search_scope: search.nullable(), recommendation_ids: z.array(id),
});
export const evaluationSchema = z.strictObject({
  score_scale: z.literal('ordinal_0_3'),
  score_conversion: z.literal('percentage_to_ordinal_v1').optional(),
  schema_version: z.literal(2), policy_id: id, language: z.literal('pt'), index: z.literal('documentary_information_quality'),
  method_version: id, profile_id: z.literal('core-14-v1'), profile_sha256: hash,
  validation_status: z.literal('not_human_validated'), input_status: z.enum(['complete_input', 'partial_input', 'no_usable_segments']),
  score_status: z.enum(['available', 'blocked']), score: score.nullable(),
  score_blockers: z.array(z.enum(['document_scope_incomplete', 'extraction_partial', 'truncated_segments',
    'no_usable_segments', 'unknown_applicability', 'inconclusive_questions', 'no_applicable_questions'])),
  rules_version: id, rules_sha256: hash, predictions_sha256: hash, fallback_enabled: z.boolean(),
  dimensions: z.array(dimension).length(7), findings: z.array(finding), recommendations: z.array(recommendation),
  limitations: z.array(z.string()),
});
export const versionsSchema = baseVersionsSchema.extend({ recommendations: catalogVersion.nullable() }).strict();

export const analysisResultSchema = z.strictObject({
  document_scope: resultFields.document_scope, source: resultFields.source.unwrap().strict(), preprocessing: resultFields.preprocessing.unwrap().strict(),
  extraction: resultFields.extraction.extend({ text: z.string(), page_count: z.number().int().positive().nullable(),
    pages: resultFields.extraction.shape.pages.unwrap() }).strict(),
  segments: z.array(resultFields.segments.element.extend({ char_start: count, char_end: count }).strict()),
  evaluation: evaluationSchema,
}).superRefine((r, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const eq = (a: number | null, b: number | null) => a === null || b === null ? a === b : Math.abs(a-b) < 1e-8;
  const e = r.evaluation;
  const segments = new Map(r.segments.map(s => [s.segment_id, s]));
  if (segments.size !== r.segments.length) fail('Trechos duplicados.');
  const raw = Array.from(r.extraction.text);
  for (const s of r.segments) if (s.char_end <= s.char_start || s.char_end > raw.length || raw.slice(s.char_start, s.char_end).join('') !== s.text)
    fail('Offsets globais inexatos.');
  const qs = e.dimensions.flatMap(d => d.questions);
  if (qs.length !== 14 || new Set(qs.map(q => q.id)).size !== 14 || qs.some(q => !questionIds.includes(q.id))) fail('Perfil central incompleto.');
  const expectedDims = [...new Set(questionIds.map(q => q.split('.')[0]))];
  if (new Set(e.dimensions.map(d => d.id)).size !== 7 || e.dimensions.some(d => !expectedDims.includes(d.id))) fail('Dimensões inválidas.');
  const blockers: string[] = [];
  if (r.document_scope !== 'full_document') blockers.push('document_scope_incomplete');
  if (r.extraction.status !== 'ok') blockers.push('extraction_partial');
  if (r.segments.some(s => s.truncated)) blockers.push('truncated_segments');
  const usable = r.segments.filter(s => !s.truncated).length;
  if (!usable) blockers.push('no_usable_segments');
  if (qs.some(q => q.status === 'inconclusive')) blockers.push('inconclusive_questions');
  if (JSON.stringify(e.score_blockers) !== JSON.stringify(blockers)) fail('Bloqueios inconsistentes.');
  const input = !usable ? 'no_usable_segments' : blockers.some(b => b !== 'inconclusive_questions') ? 'partial_input' : 'complete_input';
  if (e.input_status !== input || e.score_status !== (blockers.length ? 'blocked' : 'available')) fail('Estado de entrada ou nota inválido.');
  if (e.policy_id !== r.source.sha256) fail('Identidade da política divergente.');
  const findings = new Map(e.findings.map(f => [f.id, f]));
  if (findings.size !== e.findings.length) fail('Achados duplicados.');
  const weights = e.dimensions.reduce((sum, d) => sum+d.weight, 0);
  for (const d of e.dimensions) {
    if (d.questions.length !== 2 || d.questions.some(q => q.dimension_id !== d.id || !q.id.startsWith(d.id+'.'))) fail('Perguntas em dimensão incorreta.');
    const resolved = d.questions.filter(q => q.value !== null).length;
    const points = d.questions.reduce((sum, q) => sum+(q.value ?? 0), 0);
    const expected = resolved === 2 && usable ? classifyPercentage(points*50) : null;
    if (d.applicable_questions !== 2 || d.unknown_applicability_questions !== 0 || d.excluded_questions !== 0 ||
      d.resolved_questions !== resolved || d.inconclusive_questions !== 2-resolved || !eq(d.earned_points, points) ||
      !eq(d.score, expected) || !eq(d.normalized_weight, d.weight/weights) ||
      d.status !== (expected === null ? 'unresolved' : 'resolved') ||
      !eq(d.contribution, blockers.length ? null : points/2 * 3 * d.weight/weights)) fail('Memória de cálculo inconsistente.');
  }
  const percentage = e.dimensions.reduce((sum, d) => sum + 50 * d.earned_points * d.weight/weights, 0);
  if (!eq(e.score, blockers.length ? null : classifyPercentage(Math.min(100, percentage)))) fail('Nota global inconsistente.');
  const checkScope = (s: z.infer<typeof search>) => {
    if (s.searched_segment_ids.some(id => !segments.has(id) || segments.get(id)!.truncated) ||
      s.excluded_segment_ids.some(id => !segments.get(id)?.truncated)) fail('Escopo de busca inválido.');
  };
  const checkGroup = (g: z.infer<typeof group>) => {
    const labels = ['First Party Collection/Use','Third Party Sharing/Collection','User Choice/Control',
      'User Access, Edit and Deletion','Data Retention','Data Security','Policy Change'];
    const label = labels[expectedDims.indexOf(g.rule_id.split('.')[0])];
    if (!questionIds.includes(g.rule_id) || g.rule_version !== e.rules_version) fail('Regra da evidência divergente.');
    const classified = g.evidence.some(ref => segments.get(ref.segment_id)?.labels.includes(label));
    if ((g.detection_source === 'model_and_rule') !== classified) fail('Origem de detecção inconsistente com categorias originais.');
    for (const ref of g.evidence) {
      const s = segments.get(ref.segment_id);
      if (!s || s.truncated || ref.end > Array.from(s.text).length || Array.from(s.text).slice(ref.start,ref.end).join('') !== ref.quote)
        fail('Evidência inexata ou inutilizável.');
    }
  };
  for (const q of qs) {
    if (q.rule_id !== q.id || q.rule_version !== e.rules_version ||
        [...q.supporting_groups,...q.contextual_groups].some(g => g.rule_id !== q.id)) fail('Regra da pergunta divergente.');
    const values = { supported: 1, partial: .5, not_detected: 0, inconclusive: null, not_applicable: null };
    if (q.value !== values[q.status] || q.applicability.state !== 'applicable' || q.applicability.source !== 'profile' ||
      q.applicability.source_id !== e.profile_id || q.status === 'not_applicable') fail('Estado/aplicabilidade incompatível com core-14-v1.');
    if ((q.status === 'supported' && (q.missing_elements.length || !q.supporting_groups.length)) ||
      (q.status === 'partial' && (!q.missing_elements.length || !q.supporting_groups.length)) ||
      (q.status === 'not_detected' && q.supporting_groups.length)) fail('Suporte incompatível com estado.');
    if (q.finding_ids.some(id => findings.get(id)?.question_id !== q.id)) fail('Vínculo de achado inválido.');
    checkScope(q.search_scope);
    for (const g of [...q.supporting_groups,...q.contextual_groups]) checkGroup(g);
  }
  for (const f of e.findings) {
    if (f.question_id !== null && !qs.some(q => q.id === f.question_id && q.finding_ids.includes(f.id))) fail('Achado sem pergunta correspondente.');
    f.evidence_groups.forEach(checkGroup);
    if (f.search_scope) checkScope(f.search_scope);
  }
  const recommendations = new Map(e.recommendations.map(r => [r.id, r]));
  if (recommendations.size !== e.recommendations.length) fail('Recomendações duplicadas.');
  const references = new Map<string, string>();
  const rank = {high:0,medium:1,low:2};
  for (const r of e.recommendations) {
    if (new Set(r.finding_ids).size !== r.finding_ids.length || r.finding_ids.some(id => !findings.get(id)?.recommendation_ids.includes(r.id)))
      fail('Recomendação sem vínculo recíproco com achado.');
    const linked = r.finding_ids.map(id => findings.get(id)).filter(f => f !== undefined);
    if (!linked.length || rank[r.priority] !== Math.min(...linked.map(f => rank[f.priority]))) fail('Prioridade divergente dos achados.');
    if (r.target === 'policy_wording' && linked.some(f => f.kind !== 'information_gap')) fail('Redação exige lacuna documental.');
    if (new Set(r.references.map(ref => ref.id)).size !== r.references.length) fail('Referências duplicadas.');
    for (const ref of r.references) {
      const encoded = JSON.stringify(ref);
      if (references.has(ref.id) && references.get(ref.id) !== encoded) fail('Referência com identidades divergentes.');
      references.set(ref.id, encoded);
    }
  }
  for (const f of e.findings) if (new Set(f.recommendation_ids).size !== f.recommendation_ids.length ||
      f.recommendation_ids.some(id => !recommendations.get(id)?.finding_ids.includes(f.id))) fail('Achado com recomendação inexistente.');
});

function checkCatalog(value: {versions: z.infer<typeof versionsSchema>; result: z.infer<typeof analysisResultSchema>}, ctx: z.RefinementCtx) {
  if (value.result.evaluation.recommendations.some(r => r.catalog_version !== value.versions.recommendations))
    ctx.addIssue({code:'custom',message:'Versão do catálogo divergente ou ausente.'});
}
export const inferenceResponseSchema = z.strictObject({ schema_version: z.literal(2), versions: versionsSchema, result: analysisResultSchema }).superRefine(checkCatalog);
const common = { schema_version: z.literal(2), analysis_id: z.uuid(), created_at: z.iso.datetime(),
  original_filename: id, supersedes_analysis_id: z.uuid().nullable(), profile_id: z.literal('core-14-v1') };
export const analysisResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...common, status: z.literal('processing'), versions: z.null(), result: z.null(), error: z.null() }),
  z.strictObject({ ...common, status: z.literal('completed'), versions: versionsSchema, result: analysisResultSchema, error: z.null() }),
  z.strictObject({ ...common, status: z.literal('failed'), versions: versionsSchema.nullable(), result: z.null(), error: apiErrorSchema }),
]).superRefine((value, ctx) => { if (value.status === 'completed') checkCatalog(value, ctx); });
