FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

RUN cd apps/web && pnpm build

FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/web/.next ./apps/web/.next

EXPOSE 3000

CMD ["pnpm", "--filter", "@orbital/web", "start"]
