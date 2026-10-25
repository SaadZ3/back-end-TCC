# Backend do protótipo

O projeto usa um único método de avaliação da qualidade da informação documentada, com notas de **0 a 3**. Consulte [a atualização do método](../docs/AVALIACAO_UNIFICADA.md).

Node 22.17, TypeScript, Express e PostgreSQL/Prisma. Consulte o [guia da raiz](../README.md) para instalação e o [procedimento do banco](../docs/BANCO.md) antes de migrations.

Comandos: npm ci; npm run prisma:generate; npm run build; npm run lint; npm test; npm run dev.
Configuração: .env baseado em .env.example, sem sobrescrever arquivo existente.

npm run dev usa tsx watch. nodemon.json, .sequelizerc e configurações JavaScript antigas são legados, não participam da execução TypeScript.

Autenticação: POST /api/auth/register, /api/auth/login, /api/auth/logout e perfil em GET /api/users/me. O cadastro público cria apenas EVALUATOR, normaliza o e-mail e inicia sessão HttpOnly. Cadastro tem limite de 10 tentativas por hora/IP; login tem limite de 20 falhas por 15 minutos/IP. Módulos antigos preservados no código, sem rotas expostas.

Crie contas pelo formulário /register ou com npm run user:create conforme o [README da raiz](../README.md). Aplique todas as migrations pendentes com npm run prisma:deploy. A migration 20261012000200_registration_and_analysis_deletion acrescenta um índice único para LOWER(BTRIM(email)); duplicidades legadas precisam ser resolvidas antes da aplicação, sem exclusão automática de usuários. Testes de integração e configuração estão em [docs/P2.md](../docs/P2.md).

## P5 — Análises de políticas

POST/GET /api/analyses, GET /:id e GET /:id/file exigem sessão. Execute npm run prisma:generate e npm run prisma:deploy para aplicar a migration 0003. Uploads em uploads/policies são privados; use uma instância Node. Detalhes, configuração e testes em [docs/P5.md](../docs/P5.md).

DELETE /api/analyses/:id exige sessão, origem confiável e propriedade da análise. Retorna 204 ao excluir, 404 para análise inexistente/de outro usuário e 409 durante processamento. Remove o registro e o arquivo original, preservando reanálises com vínculo nulo. Um arquivo já ausente não impede a exclusão. Se o disco recusar a remoção física, o registro continua excluído e o arquivo deixa de ser acessível pela API; o identificador é registrado no log para limpeza administrativa do arquivo órfão.
