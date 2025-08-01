# Use Bun
FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    wget

# Set Playwright to use system Chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Install dev dependencies for build
RUN bun install --frozen-lockfile

# Build TypeScript
RUN bun run build

# Remove dev dependencies after build
RUN bun install --frozen-lockfile --production

# Create non-root user
RUN addgroup -g 1001 -S bunuser
RUN adduser -S bunuser -u 1001

# Change ownership of the app directory
RUN chown -R bunuser:bunuser /app
USER bunuser

# Expose port (DigitalOcean App Platform uses PORT env var)
EXPOSE 3000
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/', method: 'GET' }; \
    const req = http.request(options, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start the application
CMD ["bun", "run", "start:prod"]
