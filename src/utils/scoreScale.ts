/** Aplica a escala 0–3 e adapta resultados antigos somente durante a leitura. */
export const SCORE_SCALE = 'ordinal_0_3' as const;
export type Grade = 0 | 1 | 2 | 3;
// Mesma tolerância do Python para resíduos de cálculo nas fronteiras das faixas.
const BOUNDARY_TOLERANCE = 1e-12;

/** Recebe percentual finito entre 0 e 100 e retorna sua faixa inteira de 0 a 3. */
export function classifyPercentage(value: number): Grade {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError('O percentual deve ser finito e estar entre 0 e 100.');
  }
  if (value <= 25 + BOUNDARY_TOLERANCE) return 0;
  if (value <= 50 + BOUNDARY_TOLERANCE) return 1;
  if (value <= 75 + BOUNDARY_TOLERANCE) return 2;
  return 3;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converte uma cópia do registro antigo; a ausência da escala identifica percentuais, inclusive 0 a 3. */
export function normalizeStoredResult(result: unknown): unknown {
  if (!record(result) || !record(result.evaluation) || result.evaluation.score_scale !== undefined) return result;
  const converted = structuredClone(result);
  const evaluation = converted.evaluation as Record<string, unknown>;
  if (typeof evaluation.score === 'number') {
    evaluation.score = classifyPercentage(evaluation.score);
  }
  if (Array.isArray(evaluation.dimensions)) {
    for (const dimension of evaluation.dimensions) {
      if (!record(dimension)) continue;
      if (typeof dimension.score === 'number') dimension.score = classifyPercentage(dimension.score);
      if (typeof dimension.contribution === 'number') dimension.contribution = dimension.contribution * 3 / 100;
    }
  }
  evaluation.score_scale = SCORE_SCALE;
  evaluation.score_conversion = 'percentage_to_ordinal_v1';
  return converted;
}
