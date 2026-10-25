export const SCORE_SCALE = 'ordinal_0_3' as const;
export type Grade = 0 | 1 | 2 | 3;
// Mesma tolerância do Python para resíduos de cálculo nas fronteiras das faixas.
const BOUNDARY_TOLERANCE = 1e-12;

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
  for (const key of ['score']) {
    if (typeof evaluation[key] === 'number') evaluation[key] = classifyPercentage(evaluation[key]);
  }
  for (const key of ['dimensions']) {
    if (!Array.isArray(evaluation[key])) continue;
    for (const item of evaluation[key]) {
      if (!record(item)) continue;
      if (typeof item.score === 'number') item.score = classifyPercentage(item.score);
      if (typeof item.contribution === 'number') item.contribution = item.contribution * 3 / 100;
    }
  }
  evaluation.score_scale = SCORE_SCALE;
  evaluation.score_conversion = 'percentage_to_ordinal_v1';
  return converted;
}
