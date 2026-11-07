/** Valida a resposta da inferência, incluindo notas, evidências e vínculos. */
import { z } from 'zod';
import { classifyPercentage } from '../utils/scoreScale.js';
import { metadataSchema, resultFields, apiErrorSchema, evidenceSchema, baseVersionsSchema } from './analysis.shared.js';
export { errorResponseSchema } from './analysis.shared.js';

const id = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative();
const score = z.number().min(0).max(3);
const contribution = z.number().min(0).max(3);
const fraction = z.number().min(0).max(1);
const catalogVersion = z.string().regex(/^[a-z0-9-]+:[a-f0-9]{64}$/);
const reference = z.strictObject({
  id,
  source_type: z.enum(['project_rubric', 'public_guidance']),
  title: id,
  edition: id.nullable(),
  section: id.nullable(),
  pdf_page: z.null(),
  url: z.url().refine(value => value.startsWith('https://')).nullable(),
  verified_by: id,
  verified_at: z.iso.date(),
  verification_scope: z.enum(['provided_workbook', 'project_document']),
  source_file: id,
  source_sha256: hash,
  source_locator: id,
  control_role: z.enum(['controller', 'processor', 'shared', 'project']),
  summary: id,
}).superRefine((r, ctx) => {
  if ((r.source_type === 'public_guidance' && (r.verification_scope !== 'provided_workbook' || !r.url || r.control_role === 'project')) ||
    (r.source_type === 'project_rubric' && (r.verification_scope !== 'project_document' || r.control_role !== 'project')))
    ctx.addIssue({ code: 'custom', message: 'Origem da referência inconsistente.' });
});
const recommendation = z.strictObject({
  id,
  template_id: id,
  catalog_version: catalogVersion,
  finding_ids: z.array(id).min(1),
  target: z.enum(['policy_wording', 'organizational_verification']),
  trigger_reason: id,
  what_to_do: id,
  how_to_do: z.array(id).min(1),
  completion_evidence: z.array(id).min(1),
  suggested_role: id.nullable(),
  references: z.array(reference).min(1),
  pending_fields: z.array(id).min(1),
  priority: z.enum(['high', 'medium', 'low']),
  priority_reason: id,
  applicability_note: id,
});
const states = ['supported', 'partial', 'not_detected', 'inconclusive', 'not_applicable'] as const;
const historicalQuestionIds = ['collection.data_types', 'collection.purposes', 'sharing.recipients', 'sharing.conditions',
  'choice.mechanism', 'choice.channel', 'access.channel', 'access.response_time', 'retention.duration',
  'retention.disposal', 'security.technical_measures', 'security.access_controls', 'changes.notice_channel', 'changes.notice_timing'];

export const analysisMetadataSchema = metadataSchema.extend({
  supersedes_analysis_id: z.uuid().optional(),
});
const group = z.strictObject({
  id,
  evidence: z.array(evidenceSchema.refine(e => e.end > e.start && e.quote.length > 0)).min(1).max(2),
  polarity: z.enum(['affirmed', 'negated', 'conditional', 'uncertain']),
  detection_source: z.enum(['model_and_rule', 'rule_only']),
  rule_id: id,
  rule_version: id,
  rationale: id,
});
const search = z.strictObject({
  searched_segment_ids: z.array(id),
  excluded_segment_ids: z.array(id),
  category_pass: z.boolean(),
  fallback_pass: z.boolean(),
  fallback_reason: z.string().nullable()
});
const question = z.strictObject({
  id,
  dimension_id: id,
  title: id,
  status: z.enum(states),
  value: z.union([z.literal(0), z.literal(.5), z.literal(1)]).nullable(),
  applicability: z.strictObject({
    state: z.enum(['applicable', 'not_applicable', 'unknown']),
    source: z.enum(['profile', 'user']),
    source_id: id,
    reason: id,
    declared_at: z.iso.datetime({ offset: true })
  }),
  rule_id: id,
  rule_version: id,
  rationale: id,
  found_elements: z.array(id),
  missing_elements: z.array(id),
  supporting_groups: z.array(group),
  contextual_groups: z.array(group),
  search_scope: search,
  finding_ids: z.array(id),
  duplicate_occurrences_omitted: count,
});
const dimension = z.strictObject({
  id,
  title: id,
  weight: z.number().positive(),
  normalized_weight: fraction.nullable(),
  status: z.enum(['resolved', 'unresolved', 'not_applicable']),
  score: score.nullable(),
  contribution: contribution.nullable(),
  earned_points: z.number().nonnegative(),
  applicable_questions: count,
  unknown_applicability_questions: count,
  resolved_questions: count,
  inconclusive_questions: count,
  excluded_questions: count,
  questions: z.array(question),
});
const finding = z.strictObject({
  id,
  dimension_id: id.nullable(),
  question_id: id.nullable(),
  rule_id: id,
  rule_version: id,
  kind: z.enum(['information_gap', 'ambiguity', 'contradiction', 'practice_statement', 'extraction_limitation']),
  title: id,
  rationale: id,
  priority: z.enum(['high', 'medium', 'low']),
  priority_reason: id,
  evidence_groups: z.array(group),
  search_scope: search.nullable(),
  recommendation_ids: z.array(id),
});
const profileQuestions: Record<string, string[]> = {
  'core-14-v1': historicalQuestionIds,
  'documentary-18-v1': [...historicalQuestionIds, 'dnt.response', 'dnt.effect', 'audiences.scope', 'audiences.practice'],
};
const profileSchema = z.enum(['core-14-v1', 'documentary-18-v1']);

export const evaluationSchema = z.strictObject({
  score_scale: z.enum(['ordinal_0_3', 'continuous_0_3']),
  score_conversion: z.literal('percentage_to_ordinal_v1').optional(),
  schema_version: z.literal(2),
  policy_id: id,
  language: z.literal('pt'),
  index: z.literal('documentary_information_quality'),
  method_version: id,
  uncertainty_policy: z.literal('exclude_inconclusive_evidence_v1').optional(),
  profile_id: profileSchema,
  profile_sha256: hash,
  validation_status: z.literal('not_human_validated'),
  input_status: z.enum(['complete_input', 'partial_input', 'no_usable_segments']),
  score_status: z.enum(['available', 'blocked']),
  score: score.nullable(),
  score_blockers: z.array(z.enum(['document_scope_incomplete', 'extraction_partial', 'truncated_segments',
    'no_usable_segments', 'unknown_applicability', 'inconclusive_questions', 'no_applicable_questions', 'no_evaluable_questions'])),
  rules_version: id,
  rules_sha256: hash,
  predictions_sha256: hash,
  fallback_enabled: z.boolean(),
  dimensions: z.array(dimension).min(7).max(9),
  findings: z.array(finding),
  recommendations: z.array(recommendation),
  limitations: z.array(z.string()),
}).superRefine((evaluation, ctx) => {
  if (evaluation.score_scale === 'ordinal_0_3' && [evaluation.score, ...evaluation.dimensions.map(d => d.score)]
    .some(value => value !== null && !Number.isInteger(value)))
    ctx.addIssue({ code: 'custom', message: 'A escala histórica exige notas inteiras.' });
  if (evaluation.score_scale === 'continuous_0_3' && evaluation.score_conversion !== undefined)
    ctx.addIssue({ code: 'custom', message: 'Conversão histórica não se aplica à escala contínua.' });
});
export const versionsSchema = baseVersionsSchema.extend({ recommendations: catalogVersion.nullable() }).strict();

export const analysisResultSchema = z.strictObject({
  document_scope: resultFields.document_scope,
  source: resultFields.source.unwrap().strict(),
  preprocessing: resultFields.preprocessing.unwrap().strict(),
  extraction: resultFields.extraction.extend({
    text: z.string(),
    page_count: z.number().int().positive().nullable(),
    pages: resultFields.extraction.shape.pages.unwrap()
  }).strict(),
  segments: z.array(resultFields.segments.element.extend({ char_start: count, char_end: count }).strict()),
  evaluation: evaluationSchema,
}).superRefine((result, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
  const sameNumber = (a: number | null, b: number | null) => a === null || b === null ? a === b : Math.abs(a - b) < 1e-8;
  const evaluation = result.evaluation;
  const questionIds = profileQuestions[evaluation.profile_id];
  if ((evaluation.profile_id === 'documentary-18-v1') !== (evaluation.method_version === 'documentary-quality-v5-draft1'))
    fail('Método incompatível com o perfil.');
  const excludeUncertain = ['documentary-quality-v4-draft1', 'documentary-quality-v5-draft1'].includes(evaluation.method_version);
  if (excludeUncertain !== (evaluation.uncertainty_policy === 'exclude_inconclusive_evidence_v1') ||
    (excludeUncertain && evaluation.score_scale !== 'continuous_0_3')) fail('Política de incerteza incompatível com o método.');
  const segments = new Map(result.segments.map(s => [s.segment_id, s]));
  if (segments.size !== result.segments.length) fail('Trechos duplicados.');
  const extractedCharacters = Array.from(result.extraction.text);
  for (const s of result.segments) if (s.char_end <= s.char_start || s.char_end > extractedCharacters.length || extractedCharacters.slice(s.char_start, s.char_end).join('') !== s.text)
    fail('Offsets globais inexatos.');
  const questions = evaluation.dimensions.flatMap(d => d.questions);
  if (questions.length !== questionIds.length || new Set(questions.map(q => q.id)).size !== questionIds.length || questions.some(q => !questionIds.includes(q.id))) fail('Perfil central incompleto.');
  const expectedDimensions = [...new Set(questionIds.map(q => q.split('.')[0]))];
  if (evaluation.dimensions.length !== expectedDimensions.length || new Set(evaluation.dimensions.map(d => d.id)).size !== expectedDimensions.length || evaluation.dimensions.some(d => !expectedDimensions.includes(d.id))) fail('Dimensões inválidas.');
  const blockers: string[] = [];
  if (result.document_scope !== 'full_document') blockers.push('document_scope_incomplete');
  if (result.extraction.status !== 'ok') blockers.push('extraction_partial');
  if (result.segments.some(s => s.truncated)) blockers.push('truncated_segments');
  const usableSegmentCount = result.segments.filter(s => !s.truncated).length;
  if (!usableSegmentCount) blockers.push('no_usable_segments');
  const inputPartial = blockers.length > 0;
  if (!excludeUncertain && questions.some(q => q.status === 'inconclusive')) blockers.push('inconclusive_questions');
  if (excludeUncertain && usableSegmentCount && questions.every(q => q.value === null)) blockers.push('no_evaluable_questions');
  if (JSON.stringify(evaluation.score_blockers) !== JSON.stringify(blockers)) fail('Bloqueios inconsistentes.');
  const input = !usableSegmentCount ? 'no_usable_segments' : inputPartial ? 'partial_input' : 'complete_input';
  if (evaluation.input_status !== input || evaluation.score_status !== (blockers.length ? 'blocked' : 'available')) fail('Estado de entrada ou nota inválido.');
  if (evaluation.policy_id !== result.source.sha256) fail('Identidade da política divergente.');
  const findings = new Map(evaluation.findings.map(f => [f.id, f]));
  if (findings.size !== evaluation.findings.length) fail('Achados duplicados.');
  /** Confere as notas da avaliação, sem arredondar nem mudar a ordem das somas. */
  function checkScores() {
    const grade = (percentage: number) => evaluation.score_scale === 'continuous_0_3'
      ? percentage * 3 / 100 : classifyPercentage(percentage);
    const active = (d: z.infer<typeof dimension>) => usableSegmentCount > 0 && d.questions.some(q => q.value !== null);
    const weights = evaluation.dimensions.reduce((sum, d) => sum + (!excludeUncertain || active(d) ? d.weight : 0), 0);
    for (const d of evaluation.dimensions) {
      if (d.questions.length !== 2 || d.questions.some(q => q.dimension_id !== d.id || !q.id.startsWith(d.id + '.'))) fail('Perguntas em dimensão incorreta.');
      const resolved = d.questions.filter(q => q.value !== null).length;
      const points = d.questions.reduce((sum, q) => sum + (q.value ?? 0), 0);
      const denominator = excludeUncertain ? resolved : 2;
      const expected = denominator && usableSegmentCount && (excludeUncertain || resolved === 2) ? grade(100 * points / denominator) : null;
      const weight = weights && (!excludeUncertain || active(d)) ? d.weight / weights : 0;
      if (d.applicable_questions !== 2 || d.unknown_applicability_questions !== 0 || d.excluded_questions !== (excludeUncertain ? 2 - resolved : 0) ||
        d.resolved_questions !== resolved || d.inconclusive_questions !== 2 - resolved || !sameNumber(d.earned_points, points) ||
        !sameNumber(d.score, expected) || !sameNumber(d.normalized_weight, weight) ||
        d.status !== (expected === null ? 'unresolved' : 'resolved') ||
        !sameNumber(d.contribution, blockers.length || expected === null ? null : excludeUncertain ? expected * weight : points / 2 * 3 * weight)) fail('Memória de cálculo inconsistente.');
    }
    const total = excludeUncertain
      ? Math.min(3, evaluation.dimensions.reduce((sum, d) => sum + (d.contribution ?? 0), 0))
      : grade(Math.min(100, evaluation.dimensions.reduce((sum, d) => sum + 50 * d.earned_points * d.weight / weights, 0)));
    if (!sameNumber(evaluation.score, blockers.length ? null : total)) fail('Nota global inconsistente.');
  }
  checkScores();
  const checkScope = (s: z.infer<typeof search>) => {
    if (s.searched_segment_ids.some(id => !segments.has(id) || segments.get(id)!.truncated) ||
      s.excluded_segment_ids.some(id => !segments.get(id)?.truncated)) fail('Escopo de busca inválido.');
  };
  const checkGroup = (g: z.infer<typeof group>) => {
    const labels = ['First Party Collection/Use', 'Third Party Sharing/Collection', 'User Choice/Control',
      'User Access, Edit and Deletion', 'Data Retention', 'Data Security', 'Policy Change', 'Do Not Track', 'International and Specific Audiences'];
    const label = labels[expectedDimensions.indexOf(g.rule_id.split('.')[0])];
    if (!questionIds.includes(g.rule_id) || g.rule_version !== evaluation.rules_version) fail('Regra da evidência divergente.');
    const classified = g.evidence.some(ref => segments.get(ref.segment_id)?.labels.includes(label));
    if ((g.detection_source === 'model_and_rule') !== classified) fail('Origem de detecção inconsistente com categorias originais.');
    for (const ref of g.evidence) {
      const s = segments.get(ref.segment_id);
      if (!s || s.truncated || ref.end > Array.from(s.text).length || Array.from(s.text).slice(ref.start, ref.end).join('') !== ref.quote)
        fail('Evidência inexata ou inutilizável.');
    }
  };
  /** Confere perguntas e achados usando os mapas de trechos já construídos. */
  function checkQuestionsAndFindings() {
    for (const q of questions) {
      if (q.rule_id !== q.id || q.rule_version !== evaluation.rules_version ||
        [...q.supporting_groups, ...q.contextual_groups].some(g => g.rule_id !== q.id)) fail('Regra da pergunta divergente.');
      const values = { supported: 1, partial: .5, not_detected: 0, inconclusive: null, not_applicable: null };
      if (q.value !== values[q.status] || q.applicability.state !== 'applicable' || q.applicability.source !== 'profile' ||
        q.applicability.source_id !== evaluation.profile_id || q.status === 'not_applicable') fail('Estado/aplicabilidade incompatível com o perfil.');
      if ((q.status === 'supported' && (q.missing_elements.length || !q.supporting_groups.length)) ||
        (q.status === 'partial' && (!q.missing_elements.length || !q.supporting_groups.length)) ||
        (q.status === 'not_detected' && q.supporting_groups.length)) fail('Suporte incompatível com estado.');
      if (excludeUncertain && (q.status === 'inconclusive' && (!q.contextual_groups.length || q.supporting_groups.length) ||
        q.supporting_groups.some(g => g.evidence.some(e => q.contextual_groups.some(c => c.evidence.some(ref =>
          e.segment_id === ref.segment_id && e.start < ref.end && ref.start < e.end))))))
        fail('Passagem inconclusiva não pode sustentar a pontuação.');
      if (q.finding_ids.some(id => findings.get(id)?.question_id !== q.id)) fail('Vínculo de achado inválido.');
      checkScope(q.search_scope);
      for (const g of [...q.supporting_groups, ...q.contextual_groups]) checkGroup(g);
    }
    for (const f of evaluation.findings) {
      if (f.question_id !== null && !questions.some(q => q.id === f.question_id && q.finding_ids.includes(f.id))) fail('Achado sem pergunta correspondente.');
      f.evidence_groups.forEach(checkGroup);
      if (f.search_scope) checkScope(f.search_scope);
    }
  }
  checkQuestionsAndFindings();
  /** Confere vínculos recíprocos, prioridades e referências das recomendações. */
  function checkRecommendations() {
    const recommendations = new Map(evaluation.recommendations.map(r => [r.id, r]));
    if (recommendations.size !== evaluation.recommendations.length) fail('Recomendações duplicadas.');
    const references = new Map<string, string>();
    const rank = { high: 0, medium: 1, low: 2 };
    for (const r of evaluation.recommendations) {
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
    for (const f of evaluation.findings) if (new Set(f.recommendation_ids).size !== f.recommendation_ids.length ||
      f.recommendation_ids.some(id => !recommendations.get(id)?.finding_ids.includes(f.id))) fail('Achado com recomendação inexistente.');
  }
  checkRecommendations();
});

/** Recebe resultado e contexto de validação e registra divergências da versão do catálogo. */
function checkCatalog(value: { versions: z.infer<typeof versionsSchema>; result: z.infer<typeof analysisResultSchema> ;}, ctx: z.RefinementCtx) {
  if (value.result.evaluation.recommendations.some(r => r.catalog_version !== value.versions.recommendations))
    ctx.addIssue({ code: 'custom', message: 'Versão do catálogo divergente ou ausente.' });
}
export const inferenceResponseSchema = z.strictObject({ schema_version: z.literal(2), versions: versionsSchema, result: analysisResultSchema }).superRefine(checkCatalog);
const common = {
  schema_version: z.literal(2),
  analysis_id: z.uuid(),
  created_at: z.iso.datetime(),
  original_filename: id,
  supersedes_analysis_id: z.uuid().nullable(),
  profile_id: profileSchema
};
export const analysisResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({
    ...common,
    status: z.literal('processing'),
    versions: z.null(),
    result: z.null(),
    error: z.null()
  }),
  z.strictObject({
    ...common,
    status: z.literal('completed'),
    versions: versionsSchema,
    result: analysisResultSchema,
    error: z.null()
  }),
  z.strictObject({
    ...common,
    status: z.literal('failed'),
    versions: versionsSchema.nullable(),
    result: z.null(),
    error: apiErrorSchema
  }),
]).superRefine((value, ctx) => { if (value.status === 'completed') {
  checkCatalog(value, ctx);
  if (value.profile_id !== value.result.evaluation.profile_id)
    ctx.addIssue({ code: 'custom', message: 'Perfil salvo diverge do perfil da avaliação.' });
} });
