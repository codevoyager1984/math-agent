# 基础构建阶段
FROM node:20-alpine AS base

# 依赖安装阶段
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# 配置 Alpine 国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN apk add --no-cache libc6-compat python3 make g++ curl
WORKDIR /app

# 只复制依赖相关文件
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# 启用 corepack 并配置镜像源
RUN corepack enable && \
    npm config set registry https://registry.npmmirror.com/

RUN \
    if [ -f yarn.lock ]; then yarn config set registry https://registry.npmmirror.com/ && yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then pnpm config set registry https://registry.npmmirror.com/ && pnpm i --frozen-lockfile; \
    else echo "Lockfile not found." && exit 1; \
    fi

# 构建阶段
FROM base AS builder
WORKDIR /app

# 在 builder 阶段也启用 corepack
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# 生产阶段
FROM base AS runner
WORKDIR /app

# 配置 Alpine 国内镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
RUN apk add --no-cache curl

# 只复制生产环境需要的文件
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000

COPY ./lib/db/migrations ./lib/db/migrations
COPY ./lib/db/migrate.ts ./lib/db/migrate.ts

COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
