#!/bin/bash

# DigitalOcean VPS Deployment Script for BEd Results Scraper API
# This script automates the deployment process on a fresh Ubuntu droplet

set -e

echo "🚀 BEd Results Scraper API - VPS Deployment Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run this script as root"
    exit 1
fi

print_status "Starting VPS deployment..."

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
print_status "Installing required packages..."
apt install -y curl wget git htop nginx certbot python3-certbot-nginx ufw

# Configure firewall
print_status "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Clone repository
print_status "Cloning repository..."
if [ -d "/opt/bed-api" ]; then
    rm -rf /opt/bed-api
fi

echo "Enter your GitHub repository URL (e.g., https://github.com/username/bed-api.git):"
read -r REPO_URL

git clone "$REPO_URL" /opt/bed-api
cd /opt/bed-api

# Create Docker Compose production file
print_status "Creating Docker Compose configuration..."
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
    volumes:
      - /var/log/bed-api:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  logs:
EOF

# Create log directory
mkdir -p /var/log/bed-api

# Build and start the application
print_status "Building and starting the application..."
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for container to start
print_status "Waiting for application to start..."
sleep 30

# Check if container is running
if docker ps | grep -q "bed-api-container"; then
    print_status "Application container is running"
else
    print_error "Failed to start application container"
    docker logs bed-api-container
    exit 1
fi

# Get server IP
SERVER_IP=$(curl -s http://checkip.amazonaws.com)
print_status "Server IP: $SERVER_IP"

# Configure Nginx
print_status "Configuring Nginx reverse proxy..."
cat > /etc/nginx/sites-available/bed-api << EOF
server {
    listen 80;
    server_name $SERVER_IP;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint (bypass rate limiting)
    location = /health {
        access_log off;
        proxy_pass http://localhost:3000/;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/bed-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
if nginx -t; then
    print_status "Nginx configuration is valid"
    systemctl restart nginx
    systemctl enable nginx
else
    print_error "Nginx configuration is invalid"
    exit 1
fi

# Create management scripts
print_status "Creating management scripts..."

# Deployment script
cat > /root/deploy-bed-api.sh << 'EOF'
#!/bin/bash
echo "🚀 Deploying BEd API..."
cd /opt/bed-api
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
echo "✅ Deployment complete!"
docker-compose -f docker-compose.prod.yml ps
EOF

# Monitoring script
cat > /root/monitor-bed-api.sh << 'EOF'
#!/bin/bash
echo "=== BEd API System Status ==="
echo "Date: $(date)"
echo ""
echo "=== Docker Containers ==="
docker ps
echo ""
echo "=== Application Logs (last 20 lines) ==="
docker logs --tail 20 bed-api-container
echo ""
echo "=== System Resources ==="
free -h
df -h
echo ""
echo "=== Network Connections ==="
netstat -tulpn | grep :3000
EOF

# Backup script
cat > /root/backup-bed-api.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/bed-api-logs-$DATE.tar.gz /var/log/bed-api/
cp -r /opt/bed-api $BACKUP_DIR/bed-api-config-$DATE
echo "✅ Backup created: $BACKUP_DIR"
EOF

chmod +x /root/deploy-bed-api.sh
chmod +x /root/monitor-bed-api.sh
chmod +x /root/backup-bed-api.sh

# Test the deployment
print_status "Testing the deployment..."
sleep 5

if curl -s http://localhost/ | grep -q "BEd Results Scraper API"; then
    print_status "Local test passed"
else
    print_warning "Local test failed, checking logs..."
    docker logs bed-api-container
fi

# Final status
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Your API is accessible at:"
echo "   http://$SERVER_IP/"
echo ""
echo "📋 API Endpoints:"
echo "   GET  http://$SERVER_IP/                     - Health check"
echo "   GET  http://$SERVER_IP/api/scraper/info     - API information"
echo "   POST http://$SERVER_IP/api/scraper/single   - Scrape single result"
echo "   POST http://$SERVER_IP/api/scraper/batch    - Scrape multiple results"
echo ""
echo "🛠️  Management Commands:"
echo "   /root/deploy-bed-api.sh    - Update and redeploy"
echo "   /root/monitor-bed-api.sh   - Check system status"
echo "   /root/backup-bed-api.sh    - Create backup"
echo ""
echo "📖 Next Steps:"
echo "   1. Test your API: curl http://$SERVER_IP/"
echo "   2. Set up a domain name (optional)"
echo "   3. Configure SSL with: certbot --nginx -d your-domain.com"
echo "   4. Monitor logs: docker logs -f bed-api-container"
echo ""
print_warning "Don't forget to update your GitHub repository URL in the future!"
