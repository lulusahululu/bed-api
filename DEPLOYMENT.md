# DigitalOcean Deployment Guide

This guide will help you deploy the BEd Results Scraper API to DigitalOcean's App Platform.

## Prerequisites

1. **DigitalOcean Account**: Sign up at [digitalocean.com](https://digitalocean.com)
2. **GitHub Repository**: Push your code to GitHub
3. **Docker Hub Account** (optional): For custom Docker deployments

## Deployment Options

### Option 1: Using App Platform (Recommended)

DigitalOcean App Platform is the easiest way to deploy containerized applications.

#### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Add your GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/bed-api.git
git push -u origin main
```

#### Step 2: Create App Platform Application

1. Go to [DigitalOcean Console](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Choose "GitHub" as source
4. Select your repository and branch (main)
5. Configure the app:

**App Info:**
- Name: `bed-results-scraper-api`
- Region: Choose closest to your users (e.g., `nyc1`, `sfo3`, `fra1`)

**Service Configuration:**
- Service Type: Web Service
- Source Directory: `/` (root)
- Build Command: `npm ci && npm run build`
- Run Command: `npm run start:prod`
- Port: `8080`

#### Step 3: Environment Variables

Add these environment variables in the App Platform dashboard:

```
NODE_ENV=production
PORT=8080
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
LOG_LEVEL=info
```

#### Step 4: Resource Configuration

- **Plan**: Basic ($5/month)
- **Instance Count**: 1 (can scale up later)
- **Instance Size**: Basic (512MB RAM, 1 vCPU)

#### Step 5: Deploy

1. Review settings
2. Click "Create Resources"
3. Wait for deployment (usually 5-10 minutes)

### Option 2: Using Droplets with Docker

For more control, deploy on a Droplet:

#### Step 1: Create Droplet

```bash
# Create a new droplet
doctl compute droplet create bed-api \
  --region nyc1 \
  --image docker-20-04 \
  --size s-1vcpu-1gb \
  --ssh-keys YOUR_SSH_KEY_ID
```

#### Step 2: Connect and Deploy

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Clone your repository
git clone https://github.com/YOUR_USERNAME/bed-api.git
cd bed-api

# Build and run with Docker
docker build -t bed-api .
docker run -d -p 80:3000 --name bed-api-container bed-api
```

### Option 3: Using Docker Hub

#### Step 1: Build and Push to Docker Hub

```bash
# Build the image
docker build -t YOUR_USERNAME/bed-api:latest .

# Push to Docker Hub
docker push YOUR_USERNAME/bed-api:latest
```

#### Step 2: Deploy on DigitalOcean

Use the Docker image in App Platform:
- Source Type: Docker Hub
- Repository: `YOUR_USERNAME/bed-api`
- Tag: `latest`

## Post-Deployment Configuration

### 1. Custom Domain (Optional)

1. Go to your App settings
2. Add your domain in "Domains" section
3. Update DNS records as instructed

### 2. Environment Variables

Update these based on your needs:

```bash
# Production optimizations
NODE_ENV=production
PORT=8080

# Rate limiting (adjust based on usage)
RATE_LIMIT_REQUESTS=200
RATE_LIMIT_WINDOW_MS=60000

# Logging
LOG_LEVEL=info

# If using Supabase (optional)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Scaling

Monitor your app and scale as needed:
- **Horizontal Scaling**: Increase instance count
- **Vertical Scaling**: Upgrade instance size
- **Auto-scaling**: Enable based on CPU/memory usage

## Monitoring and Maintenance

### Health Checks

The API includes built-in health checks:
- Endpoint: `GET /`
- Response: `{"status": "ok", ...}`

### Logs

View logs in DigitalOcean dashboard:
1. Go to your app
2. Click "Runtime Logs"
3. Monitor for errors and performance

### Updates

Deploy updates automatically:
1. Push changes to GitHub
2. App Platform auto-deploys
3. Zero-downtime deployments

## Troubleshooting

### Common Issues

1. **Port Configuration**: Ensure PORT is set to 8080
2. **Memory Limits**: Playwright needs sufficient memory
3. **Build Failures**: Check build logs for missing dependencies

### Performance Optimization

```bash
# Increase memory for Playwright
# In App Platform, upgrade to higher tier if needed

# Environment variables for optimization
PLAYWRIGHT_BROWSERS_PATH=/usr/bin/chromium-browser
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

## Cost Estimation

### App Platform Pricing
- **Basic Plan**: $5/month (512MB RAM, 1 vCPU)
- **Professional Plan**: $12/month (1GB RAM, 1 vCPU)
- **Additional Resources**: Scale as needed

### Bandwidth
- 100GB included
- Additional: $0.01/GB

## Security

1. **HTTPS**: Automatically enabled
2. **Environment Variables**: Secure by default
3. **Rate Limiting**: Built-in protection
4. **Updates**: Keep dependencies updated

## API Endpoints

Once deployed, your API will be available at:

```
https://YOUR_APP_NAME-XXXXX.ondigitalocean.app/

# Endpoints:
GET  /                     # Health check
GET  /api/scraper/info     # API information
POST /api/scraper/validate # Validate roll number
POST /api/scraper/single   # Scrape single result
POST /api/scraper/batch    # Scrape multiple results
```

## Example Usage

```bash
# Health check
curl https://YOUR_APP_URL/

# Validate roll number
curl -X POST https://YOUR_APP_URL/api/scraper/validate \
  -H "Content-Type: application/json" \
  -d '{"rollNumber": "1001"}'

# Scrape single result
curl -X POST https://YOUR_APP_URL/api/scraper/single \
  -H "Content-Type: application/json" \
  -d '{"rollNumber": "1001"}'
```

## Support

For issues:
1. Check DigitalOcean documentation
2. Review application logs
3. Monitor resource usage
4. Scale up if performance issues occur
