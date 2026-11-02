/** Transporta código, status HTTP e identificador da análise entre serviço e rotas. */
export class AnalysisError extends Error {
  constructor(public code: string, message: string, public statusCode: number, public analysisId?: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}
