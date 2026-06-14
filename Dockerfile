# syntax=docker/dockerfile:1

FROM node:20-alpine

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

# busybox wget ships with alpine — no extra packages needed for the healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://localhost:${PORT}/" || exit 1

CMD ["node", "server.js"]
