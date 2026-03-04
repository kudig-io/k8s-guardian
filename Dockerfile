# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run lint && npm run test

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S k8s-guardian -u 1001 -G nodejs

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --chown=k8s-guardian:nodejs . .

RUN mkdir -p logs && chown -R k8s-guardian:nodejs logs

USER k8s-guardian

EXPOSE 8080 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENV NODE_ENV=production \
    LOG_LEVEL=info \
    METRICS_ENABLED=true

CMD ["node", "bin/cli.js", "--web"]
