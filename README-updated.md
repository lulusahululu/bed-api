# BEd Results Scraper API

A fast, multi-processing Node.js API built with Hono framework for scraping BEd results from SAMS Odisha portal.

## Features

- 🚀 **Fast & Efficient**: Built with Hono framework for high performance
- 🔄 **Multi-Processing**: Supports clustering for batch scraping
- 🤖 **OCR Captcha Solving**: Automatic captcha solving using Tesseract.js
- 🛡️ **Rate Limiting**: Built-in rate limiting and request validation
- 📊 **Real-time Processing**: Live progress tracking for batch operations
- 🐳 **Docker Ready**: Containerized for easy deployment
- 🔧 **TypeScript**: Fully typed for better development experience

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bed-api

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment configuration
cp .env.example .env

# Build the project
npm run build

# Start development server
npm run dev
```

### Docker Deployment

```bash
# Build Docker image
docker build -t bed-api .

# Run with Docker Compose
docker-compose up -d
```

## API Endpoints

### Health Check
```http
GET /
```

### API Information
```http
GET /api/scraper/info
```

### Health Check (Scraper)
```http
GET /api/scraper/health
```

### Single Roll Number Scraping
```http
POST /api/scraper/single
Content-Type: application/json

{
  "rollNumber": "ED18A02166",
  "options": {
    "headless": true,
    "maxRetries": 3,
    "timeout": 30000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "rollNumber": "ED18A02166",
    "data": {
      "rollNumber": "ED18A02166",
      "name": "YAGNASENI PRADHAN",
      "socialCategory": "SEBC",
      "score": 57.75,
      "fatherName": "",
      "motherName": "",
      "course": "",
      "stream": "",
      "category": "",
      "district": "",
      "college": "",
      "subjects": []
    },
    "timestamp": "2025-06-15T16:43:39.941Z",
    "processingTime": 4421
  },
  "timestamp": "2025-06-15T16:43:39.942Z"
}
```

### Batch Roll Number Scraping
```http
POST /api/scraper/batch
Content-Type: application/json

{
  "rollNumbers": ["ED18A02166", "ED18A02167", "ED18A02168"],
  "options": {
    "maxWorkers": 2,
    "headless": true,
    "maxRetries": 3
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "total": 3,
    "completed": 3,
    "results": [...],
    "errors": [],
    "processingTime": 7250
  },
  "message": "Processed 3/3 roll numbers (3 successful)",
  "timestamp": "2025-06-15T16:44:13.077Z"
}
```

### Test Endpoint
```http
GET /api/scraper/test
```

## Configuration

Environment variables can be configured in `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30

# Scraping Configuration
MAX_WORKERS=4
MAX_RETRY_ATTEMPTS=3
SCRAPING_TIMEOUT_MS=30000

# Browser Configuration
HEADLESS_MODE=true
BROWSER_TIMEOUT_MS=30000
```

## API Features

### Rate Limiting
- Default: 30 requests per 60 seconds
- Applied to all `/api/*` routes
- Configurable via environment variables

### Error Handling
- Comprehensive error responses
- Retry logic for failed captcha attempts
- Graceful handling of network timeouts

### Validation
- Roll number format validation (`ED\d{2}A\d{5}`)
- Request body validation
- Input sanitization

### Multi-Processing
- Automatic worker allocation based on batch size
- Optimal performance for large batches
- Real-time progress tracking

## Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run start:prod   # Start with production environment
npm run clean        # Clean build directory
npm run type-check   # Type check without build
```

### Project Structure

```
src/
├── core/
│   ├── scraper.ts           # Core scraping engine
│   └── cluster-manager.ts   # Multi-processing manager
├── routes/
│   └── scraper.ts          # API route handlers
├── types/
│   └── index.ts            # TypeScript interfaces
├── utils/
│   └── helpers.ts          # Utility functions
├── config/
│   └── index.ts            # Configuration settings
└── index.ts                # Main application entry
```

## Production Deployment

### Docker
```bash
docker build -t bed-api .
docker run -p 3000:3000 -e NODE_ENV=production bed-api
```

### Manual Deployment
```bash
npm run build
NODE_ENV=production npm run start:prod
```

### Monitoring
- Health checks available at `/` and `/api/scraper/health`
- Request logging with processing times
- Error tracking and reporting

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository.
