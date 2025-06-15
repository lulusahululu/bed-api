# Appwrite Function Deployment Guide

## Overview

This is a simplified version of the BEd Results Scraper API adapted for Appwrite Functions. 

⚠️ **Important Limitations**: Appwrite Functions don't support browser automation (Playwright), so this version provides validation and API structure without actual scraping capabilities.

## Features

✅ **Available:**
- Roll number validation
- API structure and routing
- Rate limiting (50 requests/minute)
- Health checks and info endpoints
- Proper error handling

❌ **Not Available:**
- Browser automation (Playwright)
- Actual web scraping
- Captcha solving
- Multi-processing

## Deployment Steps

### 1. Install Appwrite CLI

```bash
npm install -g appwrite-cli
```

### 2. Login to Appwrite

```bash
appwrite login
```

### 3. Initialize Project

```bash
cd appwrite-function
appwrite init function
```

### 4. Deploy Function

```bash
appwrite functions deploy --function-id YOUR_FUNCTION_ID
```

## Alternative Deployment Options

For full scraping functionality, consider these alternatives:

### Option 1: VPS/Cloud Server
Deploy the full API to:
- DigitalOcean Droplet
- AWS EC2
- Google Cloud Compute
- Linode
- Vultr

```bash
# Example deployment to Ubuntu server
git clone <repository>
cd bed-api
npm install
npx playwright install chromium
npm run build
npm run start:prod
```

### Option 2: Vercel (with limitations)
```bash
npm install -g vercel
vercel --prod
```
*Note: Vercel has browser limitations too*

### Option 3: Railway
```bash
npm install -g @railway/cli
railway login
railway deploy
```

### Option 4: Docker Deployment
```bash
docker build -t bed-api .
docker run -p 3000:3000 bed-api
```

## Environment Variables

For full deployment, set these variables:

```env
NODE_ENV=production
PORT=3000
RATE_LIMIT_MAX_REQUESTS=100
MAX_RETRY_ATTEMPTS=3
HEADLESS_MODE=true
BROWSER_TIMEOUT_MS=30000
```

## API Endpoints (Appwrite Version)

- `GET /` - Health check
- `GET /info` - API information
- `POST /validate` - Validate roll number format
- `POST /single` - Returns limitation message

## Testing the Appwrite Function

```bash
# Health check
curl https://[APPWRITE_ENDPOINT]/functions/[FUNCTION_ID]/executions \
  -X POST \
  -H "X-Appwrite-Project: [PROJECT_ID]" \
  -H "Content-Type: application/json" \
  -d '{"path": "/", "method": "GET"}'

# Validate roll number
curl https://[APPWRITE_ENDPOINT]/functions/[FUNCTION_ID]/executions \
  -X POST \
  -H "X-Appwrite-Project: [PROJECT_ID]" \
  -H "Content-Type: application/json" \
  -d '{"path": "/validate", "method": "POST", "body": "{\"rollNumber\":\"ED18A02166\"}"}'
```

## Recommended Production Setup

For production use with full scraping capabilities:

1. **Deploy to VPS** with Docker
2. **Use Nginx** as reverse proxy
3. **Set up SSL** with Let's Encrypt
4. **Configure monitoring** with logs
5. **Implement backup** strategies

## Migration Path

If you start with Appwrite and later need full functionality:

1. Keep Appwrite function for validation/health checks
2. Deploy full API to VPS/cloud
3. Use Appwrite function as a router/proxy
4. Gradually migrate traffic to full API

## Support

For full scraping functionality, the standalone deployment is recommended over Appwrite Functions due to browser automation requirements.
