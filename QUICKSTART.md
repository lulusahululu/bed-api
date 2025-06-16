# Quick Start: Deploy to DigitalOcean VPS

Follow these steps to deploy your BEd Results Scraper API to a DigitalOcean VPS (Droplet):

## 1. Prepare Your Code

```bash
# Build and test locally first
npm run build
npm run start:prod

# Test the API
curl http://localhost:3000
```

## 2. Create DigitalOcean Droplet

### Using Web Interface
1. Go to [DigitalOcean Droplets](https://cloud.digitalocean.com/droplets)
2. Click "Create Droplet"
3. Choose:
   - **Image**: Docker on Ubuntu 22.04
   - **Plan**: Basic $12/month (1 vCPU, 2GB RAM) - Recommended for Playwright
   - **Region**: Choose closest to your users
   - **Authentication**: Add your SSH key
   - **Hostname**: `bed-api-server`

### Using CLI
```bash
# Install and setup doctl
brew install doctl
doctl auth init

# Create droplet
doctl compute droplet create bed-api-server \
  --region nyc1 \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1)
```

## 3. Deploy to VPS

```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx

# Clone your repository
git clone https://github.com/YOUR_USERNAME/bed-api.git
cd bed-api

# Deploy with Docker Compose
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'
services:
  bed-api:
    build: .
    container_name: bed-api-container
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - RATE_LIMIT_REQUESTS=200
      - RATE_LIMIT_WINDOW_MS=60000
      - LOG_LEVEL=info
EOF

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

## 4. Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
cat > /etc/nginx/sites-available/bed-api << 'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/bed-api /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## 5. Set up SSL (Optional but Recommended)

```bash
# Install SSL certificate
certbot --nginx -d your-domain.com

# Set up auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

## 6. Configure Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
```

## 7. Test Your API

```bash
# Test from your local machine (replace with your droplet IP or domain)
curl http://YOUR_DROPLET_IP/

# Test API endpoints
curl http://YOUR_DROPLET_IP/api/scraper/info

# Test scraping
curl -X POST http://YOUR_DROPLET_IP/api/scraper/single \
  -H "Content-Type: application/json" \
  -d '{"rollNumber": "1001"}'
```

## Estimated Costs

- **1GB RAM Droplet**: $6/month
- **2GB RAM Droplet**: $12/month (recommended)
- **Domain**: $10-15/year (optional)

## Management Commands

```bash
# View application logs
docker logs -f bed-api-container

# Restart application
docker-compose -f docker-compose.prod.yml restart

# Update application (after pushing changes to GitHub)
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## Benefits of VPS Deployment

- ✅ Full control over environment
- ✅ Better performance for Playwright
- ✅ Cost-effective for long-term use
- ✅ No build time limitations
- ✅ Can install any system dependencies
- ✅ Direct SSH access for debugging

For detailed instructions and advanced configuration, see `DEPLOYMENT.md`.
