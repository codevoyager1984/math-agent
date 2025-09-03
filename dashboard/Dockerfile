# 使用官方 Node.js 作为基础镜像
FROM node:18

WORKDIR /app

COPY package.json yarn.lock ./

# Install Yarn 4.7.0
RUN corepack enable && yarn set version 4.7.0

# Install dependencies and build
RUN yarn install --immutable && \
    yarn cache clean

COPY . .

RUN yarn build || (echo "Build failed" && yarn install && yarn build)

EXPOSE 3000

CMD ["yarn", "start"]
