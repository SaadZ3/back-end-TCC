import { prisma } from '../src/lib/prisma.js';

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // ========================================
  // Questionário 1: LGPD — Conformidade Geral
  // ========================================
  const lgpdQuestionnaire = await prisma.questionnaire.create({
    data: {
      title: 'Avaliação de Conformidade LGPD',
      description: 'Questionário para avaliar o nível de conformidade da organização com a Lei Geral de Proteção de Dados (Lei 13.709/2018).',
      category: 'LGPD',
      version: 1,
      is_active: true,
      questions: {
        create: [
          // --- GOVERNANÇA ---
          {
            text: 'A organização possui uma Política de Privacidade e Proteção de Dados formalmente documentada e aprovada pela alta direção?',
            guidance: 'Verificar se existe documento formal, data de aprovação e assinatura da direção. Art. 50 da LGPD.',
            domain: 'GOVERNANCE',
            weight: 3,
            order: 1,
          },
          {
            text: 'Foi designado um Encarregado de Proteção de Dados (DPO) com responsabilidades claramente definidas?',
            guidance: 'Art. 41 da LGPD exige a indicação do DPO. Verificar se há ato formal de nomeação.',
            domain: 'GOVERNANCE',
            weight: 3,
            order: 2,
          },
          {
            text: 'Existe um programa de conscientização e treinamento sobre proteção de dados para todos os colaboradores?',
            guidance: 'Avaliar periodicidade dos treinamentos, cobertura (% de colaboradores treinados) e conteúdo abordado.',
            domain: 'GOVERNANCE',
            weight: 2,
            order: 3,
          },
          {
            text: 'A organização realiza auditorias internas periódicas sobre conformidade com a LGPD?',
            guidance: 'Verificar frequência, escopo e planos de ação resultantes das auditorias.',
            domain: 'GOVERNANCE',
            weight: 2,
            order: 4,
          },
          // --- TRATAMENTO DE DADOS ---
          {
            text: 'Existe um inventário/mapeamento completo de todas as atividades de tratamento de dados pessoais (ROPA)?',
            guidance: 'Art. 37 da LGPD. Verificar se cobre todas as áreas, tipos de dados, finalidades e bases legais.',
            domain: 'DATA_PROCESSING',
            weight: 3,
            order: 5,
          },
          {
            text: 'As bases legais para cada atividade de tratamento estão documentadas e são adequadas?',
            guidance: 'Art. 7 e 11 da LGPD. Verificar se cada tratamento tem base legal identificada e justificada.',
            domain: 'DATA_PROCESSING',
            weight: 3,
            order: 6,
          },
          {
            text: 'Os contratos com operadores/processadores de dados incluem cláusulas de proteção de dados?',
            guidance: 'Art. 39 da LGPD. Verificar cláusulas contratuais com fornecedores que tratam dados pessoais.',
            domain: 'DATA_PROCESSING',
            weight: 2,
            order: 7,
          },
          {
            text: 'A organização aplica o princípio da minimização de dados, coletando apenas o necessário?',
            guidance: 'Art. 6, III da LGPD — princípio da necessidade. Verificar se há coleta excessiva.',
            domain: 'DATA_PROCESSING',
            weight: 2,
            order: 8,
          },
          // --- DIREITOS DOS TITULARES ---
          {
            text: 'Existem processos documentados para atender solicitações de titulares (acesso, correção, exclusão, portabilidade)?',
            guidance: 'Art. 18 da LGPD. Verificar se há canal de atendimento, formulários e SLAs definidos.',
            domain: 'DATA_SUBJECT_RIGHTS',
            weight: 3,
            order: 9,
          },
          {
            text: 'O prazo de resposta às solicitações dos titulares está sendo cumprido conforme a LGPD?',
            guidance: 'Art. 18, §5 — prazo de 15 dias. Verificar métricas de cumprimento de prazo.',
            domain: 'DATA_SUBJECT_RIGHTS',
            weight: 2,
            order: 10,
          },
          {
            text: 'Os termos de consentimento são claros, específicos e de fácil compreensão pelos titulares?',
            guidance: 'Art. 8 da LGPD. Avaliar clareza, granularidade e facilidade de revogação do consentimento.',
            domain: 'DATA_SUBJECT_RIGHTS',
            weight: 2,
            order: 11,
          },
          // --- SEGURANÇA ---
          {
            text: 'Existem controles técnicos de segurança adequados (criptografia, controle de acesso, firewall, antivírus)?',
            guidance: 'Art. 46 da LGPD. Verificar implementação de controles técnicos proporcionais aos riscos.',
            domain: 'SECURITY',
            weight: 3,
            order: 12,
          },
          {
            text: 'É realizada gestão de vulnerabilidades com testes de segurança periódicos?',
            guidance: 'Verificar frequência de vulnerability scans, pentests e planos de remediação.',
            domain: 'SECURITY',
            weight: 2,
            order: 13,
          },
          {
            text: 'Existe política de controle de acesso baseada no princípio do menor privilégio?',
            guidance: 'Verificar se o acesso a dados pessoais é restrito e revisado periodicamente.',
            domain: 'SECURITY',
            weight: 2,
            order: 14,
          },
          // --- INCIDENTES ---
          {
            text: 'Existe um plano de resposta a incidentes de segurança e violação de dados pessoais?',
            guidance: 'Art. 48 da LGPD. Verificar se há plano formal, equipe definida e procedimentos de comunicação à ANPD.',
            domain: 'INCIDENT_RESPONSE',
            weight: 3,
            order: 15,
          },
          {
            text: 'São realizados exercícios ou simulações de resposta a incidentes periodicamente?',
            guidance: 'Verificar frequência das simulações e lições aprendidas documentadas.',
            domain: 'INCIDENT_RESPONSE',
            weight: 2,
            order: 16,
          },
          // --- PRIVACY BY DESIGN ---
          {
            text: 'Novos projetos, produtos e serviços passam por Avaliação de Impacto à Proteção de Dados (DPIA/RIPD)?',
            guidance: 'Art. 38 da LGPD. Verificar se há processo formal de RIPD para tratamentos de alto risco.',
            domain: 'PRIVACY_DESIGN',
            weight: 3,
            order: 17,
          },
          {
            text: 'A privacidade é considerada desde a concepção (Privacy by Design) no desenvolvimento de sistemas e processos?',
            guidance: 'Verificar se há checklist de privacidade integrado ao ciclo de desenvolvimento.',
            domain: 'PRIVACY_DESIGN',
            weight: 2,
            order: 18,
          },
        ],
      },
    },
  });

  console.log(`✅ Questionário LGPD criado: "${lgpdQuestionnaire.title}" (18 perguntas)`);

  // ========================================
  // Questionário 2: ISO 27701
  // ========================================
  const isoQuestionnaire = await prisma.questionnaire.create({
    data: {
      title: 'Avaliação ISO 27701 — Sistema de Gestão de Privacidade',
      description: 'Questionário baseado nos controles da ISO 27701:2019 para avaliar o Sistema de Gestão de Informações de Privacidade (PIMS).',
      category: 'ISO_27701',
      version: 1,
      is_active: true,
      questions: {
        create: [
          {
            text: 'A organização estabeleceu, implementou e mantém um Sistema de Gestão de Informações de Privacidade (PIMS)?',
            guidance: 'ISO 27701 cláusula 5. Verificar integração com SGSI existente (ISO 27001).',
            domain: 'GOVERNANCE',
            weight: 3,
            order: 1,
          },
          {
            text: 'A alta direção demonstra liderança e comprometimento com o PIMS através de políticas e recursos adequados?',
            guidance: 'ISO 27701 cláusula 5.1. Verificar alocação de recursos e envolvimento da direção.',
            domain: 'GOVERNANCE',
            weight: 2,
            order: 2,
          },
          {
            text: 'Foram identificados e avaliados os riscos relacionados à privacidade e proteção de dados pessoais?',
            guidance: 'ISO 27701 cláusula 6.1.2. Verificar metodologia de avaliação de riscos de privacidade.',
            domain: 'GOVERNANCE',
            weight: 3,
            order: 3,
          },
          {
            text: 'Existem procedimentos documentados para determinar as condições de coleta e tratamento de dados pessoais?',
            guidance: 'ISO 27701 controle 7.2.1. Verificar documentação de finalidades e bases legais.',
            domain: 'DATA_PROCESSING',
            weight: 2,
            order: 4,
          },
          {
            text: 'A organização implementou controles para limitar o tratamento de dados ao estritamente necessário?',
            guidance: 'ISO 27701 controle 7.4. Princípio de minimização de dados.',
            domain: 'DATA_PROCESSING',
            weight: 2,
            order: 5,
          },
          {
            text: 'Existem mecanismos para garantir a precisão, completude e atualização dos dados pessoais?',
            guidance: 'ISO 27701 controle 7.4.3. Verificar processos de qualidade de dados.',
            domain: 'DATA_PROCESSING',
            weight: 2,
            order: 6,
          },
          {
            text: 'Foram implementados mecanismos para atender os direitos dos titulares de dados conforme aplicável?',
            guidance: 'ISO 27701 controle 7.3. Verificar processos para acesso, retificação, apagamento, etc.',
            domain: 'DATA_SUBJECT_RIGHTS',
            weight: 3,
            order: 7,
          },
          {
            text: 'A organização implementou controles de segurança específicos para dados pessoais (criptografia, pseudonimização)?',
            guidance: 'ISO 27701 cláusula 6.2. Controles de segurança estendidos para privacidade.',
            domain: 'SECURITY',
            weight: 3,
            order: 8,
          },
          {
            text: 'Existem políticas e procedimentos para transferência internacional de dados pessoais?',
            guidance: 'ISO 27701 controle 7.5. Verificar salvaguardas para transferências transfronteiriças.',
            domain: 'SECURITY',
            weight: 2,
            order: 9,
          },
          {
            text: 'A organização possui procedimentos de notificação de incidentes de privacidade às autoridades e titulares?',
            guidance: 'ISO 27701 controle 6.13.1. Verificar prazos e procedimentos de notificação.',
            domain: 'INCIDENT_RESPONSE',
            weight: 3,
            order: 10,
          },
          {
            text: 'São realizadas avaliações de impacto de privacidade (PIA) para novos tratamentos ou mudanças significativas?',
            guidance: 'ISO 27701 controle 7.2.5. Verificar metodologia e critérios para realização de PIA.',
            domain: 'PRIVACY_DESIGN',
            weight: 3,
            order: 11,
          },
          {
            text: 'A organização realiza monitoramento e análise crítica do PIMS com revisões pela direção?',
            guidance: 'ISO 27701 cláusula 9. Verificar frequência e escopo das revisões.',
            domain: 'GOVERNANCE',
            weight: 2,
            order: 12,
          },
        ],
      },
    },
  });

  console.log(`✅ Questionário ISO 27701 criado: "${isoQuestionnaire.title}" (12 perguntas)`);

  // ========================================
  // Questionário 3: Privacy by Design
  // ========================================
  const pbdQuestionnaire = await prisma.questionnaire.create({
    data: {
      title: 'Avaliação de Privacy by Design',
      description: 'Questionário baseado nos 7 princípios de Privacy by Design de Ann Cavoukian para avaliar a incorporação de privacidade no desenvolvimento de sistemas e processos.',
      category: 'PRIVACY_BY_DESIGN',
      version: 1,
      is_active: true,
      questions: {
        create: [
          {
            text: 'A privacidade é tratada de forma proativa e preventiva, antecipando riscos antes que ocorram?',
            guidance: 'Princípio 1: Proativo, não reativo. Verificar se há análise prévia de riscos de privacidade.',
            domain: 'PRIVACY_DESIGN',
            weight: 3,
            order: 1,
          },
          {
            text: 'A privacidade é configurada como padrão nos sistemas e processos (Privacy by Default)?',
            guidance: 'Princípio 2: Privacidade como padrão. Verificar configurações default dos sistemas.',
            domain: 'PRIVACY_DESIGN',
            weight: 3,
            order: 2,
          },
          {
            text: 'A privacidade está incorporada na arquitetura e design dos sistemas desde o início?',
            guidance: 'Princípio 3: Privacidade incorporada ao design. Verificar se faz parte do processo de desenvolvimento.',
            domain: 'PRIVACY_DESIGN',
            weight: 3,
            order: 3,
          },
          {
            text: 'Os controles de privacidade garantem funcionalidade total sem trade-offs (soma positiva)?',
            guidance: 'Princípio 4: Funcionalidade total — soma positiva, não soma zero. Privacidade sem sacrificar funcionalidade.',
            domain: 'PRIVACY_DESIGN',
            weight: 2,
            order: 4,
          },
          {
            text: 'A proteção de dados é garantida durante todo o ciclo de vida dos dados (coleta ao descarte)?',
            guidance: 'Princípio 5: Segurança de ponta a ponta. Verificar controles em cada fase do ciclo de vida.',
            domain: 'SECURITY',
            weight: 3,
            order: 5,
          },
          {
            text: 'As práticas de privacidade são transparentes e verificáveis pelos titulares e reguladores?',
            guidance: 'Princípio 6: Visibilidade e transparência. Verificar documentação e auditabilidade.',
            domain: 'DATA_SUBJECT_RIGHTS',
            weight: 2,
            order: 6,
          },
          {
            text: 'O titular dos dados é mantido como prioridade central em todas as decisões de design?',
            guidance: 'Princípio 7: Respeito pela privacidade do usuário. Verificar se UX prioriza o controle do titular.',
            domain: 'DATA_SUBJECT_RIGHTS',
            weight: 3,
            order: 7,
          },
          {
            text: 'Existem revisões de privacidade integradas no pipeline de CI/CD ou no processo de deploy?',
            guidance: 'Verificar se há gates de privacidade automatizados ou manuais antes do deploy.',
            domain: 'PRIVACY_DESIGN',
            weight: 2,
            order: 8,
          },
          {
            text: 'A equipe de desenvolvimento recebe treinamento específico sobre Privacy by Design?',
            guidance: 'Verificar periodicidade e conteúdo de treinamentos de PbD para desenvolvedores.',
            domain: 'GOVERNANCE',
            weight: 2,
            order: 9,
          },
          {
            text: 'São utilizadas técnicas de privacidade como anonimização, pseudonimização e minimização nos sistemas?',
            guidance: 'Verificar implementação técnica de PETs (Privacy Enhancing Technologies).',
            domain: 'SECURITY',
            weight: 3,
            order: 10,
          },
        ],
      },
    },
  });

  console.log(`✅ Questionário Privacy by Design criado: "${pbdQuestionnaire.title}" (10 perguntas)`);

  // ========================================
  // Usuário admin inicial
  // ========================================
  const bcryptjs = await import('bcryptjs');
  const adminPasswordHash = await bcryptjs.hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@lgpd.com',
      password_hash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  console.log(`\n👤 Usuário admin criado: ${admin.email} (senha: admin123)`);

  console.log('\n✨ Seed concluído com sucesso!');
  console.log('   - 3 questionários criados (LGPD, ISO 27701, Privacy by Design)');
  console.log('   - 40 perguntas no total');
  console.log('   - 1 usuário administrador');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
