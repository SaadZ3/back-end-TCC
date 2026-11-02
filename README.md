# Backend do protótipo

O projeto usa um único método de avaliação da qualidade da informação documentada, com notas de **0 a 3**. Consulte [a atualização do método](../docs/AVALIACAO_UNIFICADA.md).

Node 22.17, TypeScript, Express e PostgreSQL/Prisma. Consulte o [guia da raiz](../README.md) para instalação e o [procedimento do banco](../docs/BANCO.md) antes de migrations.

Comandos: npm ci; npm run prisma:generate; npm run build; npm run lint; npm test; npm run dev.
Configuração: .env baseado em .env.example, sem sobrescrever arquivo existente.

npm run dev usa tsx watch. As configurações antigas de Nodemon, Sequelize e ESLint foram removidas; a configuração ativa de lint é eslint.config.mjs.

Autenticação: POST /api/auth/register, /api/auth/login, /api/auth/logout e perfil em GET /api/users/me. O cadastro público cria apenas EVALUATOR, normaliza o e-mail e inicia sessão HttpOnly. Cadastro tem limite de 10 tentativas por hora/IP; login tem limite de 20 falhas por 15 minutos/IP. Os módulos HTTP antigos de empresas, questionários, avaliações e relatórios foram removidos. As tabelas, migrations e o seed continuam preservados.

Crie contas pelo formulário /register ou com npm run user:create conforme o [README da raiz](../README.md). Aplique todas as migrations pendentes com npm run prisma:deploy. A migration 20261012000200_registration_and_analysis_deletion acrescenta um índice único para LOWER(BTRIM(email)); duplicidades legadas precisam ser resolvidas antes da aplicação, sem exclusão automática de usuários. Testes de integração e configuração estão em [docs/P2.md](../docs/P2.md).

## P5 — Análises de políticas

POST/GET /api/analyses, GET /:id e GET /:id/file exigem sessão. Execute npm run prisma:generate e npm run prisma:deploy para aplicar a migration 0003. Uploads em uploads/policies são privados; use uma instância Node. Detalhes, configuração e testes em [docs/P5.md](../docs/P5.md).

DELETE /api/analyses/:id exige sessão, origem confiável e propriedade da análise. Retorna 204 ao excluir, 404 para análise inexistente/de outro usuário e 409 durante processamento. Remove o registro e o arquivo original, preservando reanálises com vínculo nulo. Um arquivo já ausente não impede a exclusão. Se o disco recusar a remoção física, o registro continua excluído e o arquivo deixa de ser acessível pela API; o identificador é registrado no log para limpeza administrativa do arquivo órfão.

## Instalar e executar

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Configure DATABASE_URL e TOKEN_SECRET no seu ambiente.
npm run prisma:generate
npm run build
npm run dev
```

Em banco novo ou com histórico de migrations conhecido, aplique `npm run prisma:deploy` antes de usar a API. Para banco já existente, siga o guia do banco. `npm start` executa o build em `dist/`; nunca editar essa pasta manualmente.

## Estrutura e comunicação

```text
src/app.ts          Rotas ativas e proteção HTTP
src/server.ts       Recuperação de análises e inicialização
src/modules/auth/  Cadastro, login, logout e sessão
src/modules/user/  Consulta do perfil autenticado
src/modules/analysis/  Upload, inferência e histórico
src/contracts/     Validação dos resultados recebidos do Python
src/middlewares/   Autenticação, origem, corpo e erros
src/utils/scoreScale.ts  Leitura compatível de resultados antigos
prisma/            Schema, migrations e seed preservados
scripts/           Build, verificação do banco e criação de conta
tests/             Testes unitários, contratos e integração
uploads/           Documentos privados, fora do Git
```

O frontend chama `/api`. O backend usa `INFERENCE_URL` para chamar o Python, confere o resultado e o salva no PostgreSQL. Uma análise por vez evita concorrência sobre o modelo; uma instância Node recupera estados interrompidos ao iniciar.

## Verificar

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` cobre `tests/*.test.ts`; o lint cobre `src/`. Para integração, use um banco local exclusivo, com nome terminado em `_test`, em `TEST_DATABASE_URL`. Execute `npm run test:auth`, `npm run test:analyses` e `npm run test:migration`. `test:analyses:real` exige também `TEST_INFERENCE_URL` e `TEST_POLICY_FILE`. Os testes não devem usar o banco nem os documentos de trabalho.

`package.json` define comandos e dependências; `package-lock.json` fixa suas resoluções. `tsconfig.json` define a compilação; `prisma.config.ts` configura o Prisma; `railway.json` e `Dockerfile` definem a hospedagem. Esses arquivos não são camadas da aplicação.
