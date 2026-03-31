FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /workspace

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/shop-admin ./apps/shop-admin
COPY packages/db ./packages/db
COPY packages/shopify-core ./packages/shopify-core
COPY packages/domain ./packages/domain
COPY packages/config-typescript ./packages/config-typescript
COPY packages/config-eslint ./packages/config-eslint

RUN corepack enable
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @categoryfix/db prisma:generate
RUN pnpm --filter @categoryfix/shop-admin build

EXPOSE 3000

CMD ["pnpm", "--filter", "@categoryfix/shop-admin", "start"]
