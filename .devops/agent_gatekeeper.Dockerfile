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
COPY server.mjs ./

ENV HOST=0.0.0.0
ENV PORT=4321
ENV REQUESTS_PORT=4322
ENV NODE_ENV=production

EXPOSE 4321 4322
USER node
CMD ["node", "./server.mjs"]
