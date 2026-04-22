FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

LABEL maintainer="tbosancheros39"
LABEL description="OpenCode Telegram Bot - bridges Telegram chat to a local OpenCode server via SSE + REST API"

CMD ["node", "dist/index.js"]
