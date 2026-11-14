FROM oven/bun:1.4.4 AS builder

WORKDIR /project

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.4.4 AS production_dependencies

WORKDIR /project

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM node:26.13.1-alpine AS runner

WORKDIR /app

COPY --from=production_dependencies /project/node_modules ./node_modules
COPY --from=builder /project/dist ./dist

ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321
USER node
CMD ["node", "./dist/server/entry.mjs"]
