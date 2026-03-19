FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY . .
RUN pnpm build

# Production
FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

ARG VERSION=0.0.0
ENV APP_VERSION=$VERSION

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PROVIDER=postgres

CMD ["node", "dist/index.js"]
