FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@10
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
# A geração do cliente não acessa o banco; credenciais reais entram somente na execução.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run prisma:generate
RUN npm run build
ENV NODE_ENV=production
ENV UPLOAD_DIR=/data/policies
EXPOSE 3001
CMD ["node", "dist/server.js"]
