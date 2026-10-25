export class AnalysisError extends Error {
  constructor(public code: string, message: string, public statusCode: number, public analysisId?: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}
