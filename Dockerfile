# syntax=docker/dockerfile:1

FROM node:20-alpine

# server.js shells out to `curl` to fetch IBM prices from Yahoo Finance.
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

# Install only production dependencies (express) for a small, reproducible image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy ONLY the application code — never payslips / private statements.
COPY server.js ./
COPY public ./public

EXPOSE 3002

# Run as the unprivileged built-in "node" user.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/" >/dev/null || exit 1

CMD ["node", "server.js"]
