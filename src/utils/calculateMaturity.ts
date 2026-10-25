import { MaturityLevel } from '@prisma/client';

interface AnswerWithQuestion {
  score: number;
  question: {
    domain: string;
    weight: number;
  };
}

interface DomainScore {
  domain: string;
  score: number;
  maxScore: number;
  percentage: number;
  answeredCount: number;
}

interface MaturityResult {
  overallScore: number;
  maturityLevel: MaturityLevel;
  domainScores: DomainScore[];
  summary: {
    totalQuestions: number;
    answeredQuestions: number;
    averageScore: number;
    strongestDomain: string;
    weakestDomain: string;
  };
  recommendations: string[];
  gapAnalysis: Array<{
    domain: string;
    currentLevel: string;
    gap: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

/**
 * Determina o nível de maturidade com base no score médio (0-5).
 */
function getMaturityLevel(score: number): MaturityLevel {
  if (score <= 1.0) return 'INITIAL';
  if (score <= 2.0) return 'DEVELOPING';
  if (score <= 3.0) return 'DEFINED';
  if (score <= 4.0) return 'MANAGED';
  return 'OPTIMIZED';
}

/**
 * Retorna o nome legível do nível de maturidade.
 */
function getMaturityName(level: MaturityLevel): string {
  const names: Record<MaturityLevel, string> = {
    INITIAL: 'Inicial',
    DEVELOPING: 'Em Desenvolvimento',
    DEFINED: 'Definido',
    MANAGED: 'Gerenciado',
    OPTIMIZED: 'Otimizado',
  };
  return names[level];
}

/**
 * Gera recomendações automáticas com base nos scores por domínio.
 */
function generateRecommendations(domainScores: DomainScore[]): string[] {
  const recommendations: string[] = [];

  const recommendationMap: Record<string, Record<string, string>> = {
    GOVERNANCE: {
      low: 'Estabelecer uma política formal de privacidade e proteção de dados com responsabilidades claras.',
      medium: 'Aprimorar a estrutura de governança com comitê de privacidade e DPO formalmente designado.',
      high: 'Implementar revisões periódicas da governança e benchmarking com melhores práticas do setor.',
    },
    DATA_PROCESSING: {
      low: 'Mapear todas as atividades de tratamento de dados pessoais (ROPA - Record of Processing Activities).',
      medium: 'Implementar bases legais documentadas para cada atividade de tratamento e DPIA para operações de alto risco.',
      high: 'Automatizar o monitoramento de conformidade do tratamento de dados e integrar com sistemas de gestão.',
    },
    DATA_SUBJECT_RIGHTS: {
      low: 'Criar processos básicos para atender solicitações de titulares (acesso, correção, exclusão).',
      medium: 'Implementar portal de autoatendimento para titulares e SLAs para cada tipo de solicitação.',
      high: 'Automatizar o atendimento de solicitações e implementar métricas de eficiência.',
    },
    SECURITY: {
      low: 'Implementar controles básicos de segurança: criptografia, controle de acesso e backup.',
      medium: 'Realizar testes de penetração regulares e implementar gestão de vulnerabilidades.',
      high: 'Implementar Security Operations Center (SOC) e monitoramento contínuo de ameaças.',
    },
    INCIDENT_RESPONSE: {
      low: 'Criar plano de resposta a incidentes de segurança e violação de dados pessoais.',
      medium: 'Realizar simulações periódicas de incidentes e estabelecer comunicação com ANPD.',
      high: 'Implementar detecção automatizada de incidentes e processo de melhoria contínua pós-incidente.',
    },
    PRIVACY_DESIGN: {
      low: 'Incorporar avaliações de privacidade no ciclo de desenvolvimento de novos produtos/serviços.',
      medium: 'Implementar Privacy by Design em todos os projetos com checklist e aprovação formal.',
      high: 'Automatizar verificações de privacidade no pipeline de desenvolvimento e integrar com DevSecOps.',
    },
  };

  for (const ds of domainScores) {
    const domainRecs = recommendationMap[ds.domain];
    if (!domainRecs) continue;

    if (ds.percentage < 40) {
      recommendations.push(domainRecs.low);
    } else if (ds.percentage < 70) {
      recommendations.push(domainRecs.medium);
    } else {
      recommendations.push(domainRecs.high);
    }
  }

  return recommendations;
}

/**
 * Gera análise de gaps por domínio.
 */
function generateGapAnalysis(domainScores: DomainScore[]) {
  return domainScores.map((ds) => {
    const level = getMaturityLevel(ds.score);
    let gap: string;
    let priority: 'HIGH' | 'MEDIUM' | 'LOW';

    if (ds.percentage < 40) {
      gap = `Necessita ação urgente. Score atual ${ds.score.toFixed(1)}/5.0 — muito abaixo do aceitável.`;
      priority = 'HIGH';
    } else if (ds.percentage < 70) {
      gap = `Em progresso, mas requer melhorias. Score atual ${ds.score.toFixed(1)}/5.0.`;
      priority = 'MEDIUM';
    } else {
      gap = `Bom nível de maturidade. Score atual ${ds.score.toFixed(1)}/5.0. Foco em melhoria contínua.`;
      priority = 'LOW';
    }

    return {
      domain: ds.domain,
      currentLevel: getMaturityName(level),
      gap,
      priority,
    };
  });
}

/**
 * Calcula o nível de maturidade completo a partir das respostas de uma avaliação.
 */
export function calculateMaturity(answers: AnswerWithQuestion[]): MaturityResult {
  // Agrupar por domínio
  const domainMap = new Map<string, { totalWeightedScore: number; totalWeight: number; count: number }>();

  for (const answer of answers) {
    const { domain, weight } = answer.question;
    const current = domainMap.get(domain) ?? { totalWeightedScore: 0, totalWeight: 0, count: 0 };
    current.totalWeightedScore += answer.score * weight;
    current.totalWeight += weight * 5; // 5 é o score máximo
    current.count += 1;
    domainMap.set(domain, current);
  }

  // Calcular scores por domínio
  const domainScores: DomainScore[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [domain, data] of domainMap) {
    const score = data.totalWeight > 0 ? (data.totalWeightedScore / data.totalWeight) * 5 : 0;
    const percentage = data.totalWeight > 0 ? (data.totalWeightedScore / data.totalWeight) * 100 : 0;

    domainScores.push({
      domain,
      score: Math.round(score * 100) / 100,
      maxScore: 5,
      percentage: Math.round(percentage * 100) / 100,
      answeredCount: data.count,
    });

    totalWeightedScore += data.totalWeightedScore;
    totalWeight += data.totalWeight;
  }

  // Score geral
  const overallScore = totalWeight > 0
    ? Math.round(((totalWeightedScore / totalWeight) * 5) * 100) / 100
    : 0;

  // Ordenar por score para identificar forte/fraco
  const sorted = [...domainScores].sort((a, b) => a.score - b.score);
  const weakestDomain = sorted[0]?.domain ?? 'N/A';
  const strongestDomain = sorted[sorted.length - 1]?.domain ?? 'N/A';

  const maturityLevel = getMaturityLevel(overallScore);
  const recommendations = generateRecommendations(domainScores);
  const gapAnalysis = generateGapAnalysis(domainScores);

  return {
    overallScore,
    maturityLevel,
    domainScores,
    summary: {
      totalQuestions: answers.length,
      answeredQuestions: answers.length,
      averageScore: overallScore,
      strongestDomain,
      weakestDomain,
    },
    recommendations,
    gapAnalysis,
  };
}
