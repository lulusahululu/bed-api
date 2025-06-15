# BEd Results Scraper API Documentation

A comprehensive guide to using the BEd Results Scraper API for extracting student results from SAMS Odisha portal.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Request/Response Format](#requestresponse-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Performance Guidelines](#performance-guidelines)
- [Examples](#examples)
- [SDKs and Libraries](#sdks-and-libraries)

## Getting Started

### Base URL
```
http://localhost:3000
```

### Content Type
All requests must include:
```
Content-Type: application/json
```

### Rate Limits
- **100 requests per minute** per IP address
- Applies to all `/api/*` endpoints

## Authentication

Currently, no authentication is required for development. For production deployment, consider implementing API keys.

## API Endpoints

### 1. Health Check
Check if the API is running.

**Endpoint:** `GET /`

**Response:**
```json
{
  "status": "ok",
  "message": "BEd Results Scraper API",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2025-06-15T16:52:33.972Z",
  "endpoints": {
    "health": "/",
    "scraper": "/api/scraper",
    "info": "/api/scraper/info"
  }
}
```

### 2. API Information
Get detailed information about available endpoints.

**Endpoint:** `GET /api/scraper/info`

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "BEd Results Scraper API",
    "version": "1.0.0",
    "description": "Fast, multi-processing API for scraping BEd results from SAMS Odisha portal",
    "endpoints": {
      "GET /health": "Health check",
      "GET /info": "API information",
      "POST /single": "Scrape single roll number",
      "POST /batch": "Scrape multiple roll numbers (with clustering)",
      "GET /test": "Test scraping with sample roll number"
    }
  },
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

### 3. Scraper Health Check
Check if the scraping service is operational.

**Endpoint:** `GET /api/scraper/health`

**Response:**
```json
{
  "success": true,
  "message": "BEd Results Scraper API is running",
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

### 4. Single Roll Number Scraping
Scrape data for a single student roll number.

**Endpoint:** `POST /api/scraper/single`

**Request Body:**
```json
{
  "rollNumber": "ED18A02166",
  "options": {
    "headless": true,
    "maxRetries": 3,
    "timeout": 30000
  }
}
```

**Parameters:**
- `rollNumber` (required): Student roll number (format: `ED\d{2}A\d{5}`)
- `options` (optional): Scraping configuration
  - `headless` (boolean): Run browser in headless mode (default: true)
  - `maxRetries` (number): Maximum retry attempts (default: 3)
  - `timeout` (number): Timeout in milliseconds (default: 30000)

**Success Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "rollNumber": "ED18A02166",
    "data": {
      "rollNumber": "ED18A02166",
      "name": "YAGNASENI PRADHAN",
      "course": "B.Ed",
      "stream": "ARTS",
      "socialCategory": "SEBC",
      "score": 57.75,
      "barcodeNumber": "25TE021221614",
      "entranceRollNumber": "ED18A02166",
      "remarks": "PRESENT"
    },
    "timestamp": "2025-06-15T16:52:33.972Z",
    "processingTime": 1945
  },
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

**Error Response:**
```json
{
  "success": true,
  "data": {
    "success": false,
    "rollNumber": "ED18A99999",
    "error": "No record found",
    "timestamp": "2025-06-15T16:52:33.972Z",
    "processingTime": 5230
  },
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

### 5. Batch Roll Number Scraping
Scrape data for multiple student roll numbers using multi-processing.

**Endpoint:** `POST /api/scraper/batch`

**Request Body:**
```json
{
  "rollNumbers": ["ED18A02166", "ED18A02167", "ED18A02168"],
  "options": {
    "maxWorkers": 2,
    "headless": true,
    "maxRetries": 3
  }
}
```

**Parameters:**
- `rollNumbers` (required): Array of roll numbers (max 100 per request)
- `options` (optional): Scraping configuration
  - `maxWorkers` (number): Number of parallel workers (default: auto-calculated)
  - `headless` (boolean): Run browsers in headless mode (default: true)
  - `maxRetries` (number): Maximum retry attempts per roll number (default: 3)

**Success Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "total": 3,
    "completed": 3,
    "results": [
      {
        "success": true,
        "rollNumber": "ED18A02166",
        "data": {
          "rollNumber": "ED18A02166",
          "name": "YAGNASENI PRADHAN",
          "course": "B.Ed",
          "stream": "ARTS",
          "socialCategory": "SEBC",
          "score": 57.75,
          "barcodeNumber": "25TE021221614",
          "entranceRollNumber": "ED18A02166",
          "remarks": "PRESENT"
        },
        "timestamp": "2025-06-15T16:52:33.972Z",
        "processingTime": 1945
      }
    ],
    "errors": [],
    "processingTime": 7250
  },
  "message": "Processed 3/3 roll numbers (3 successful)",
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

### 6. Test Endpoint
Test the scraping functionality with a sample roll number.

**Endpoint:** `GET /api/scraper/test`

**Response:** Same format as single roll number scraping.

## Request/Response Format

### Student Data Schema
```json
{
  "rollNumber": "string",           // Student roll number
  "name": "string",                 // Student name
  "course": "string",               // Course (e.g., "B.Ed")
  "stream": "string",               // Stream (e.g., "ARTS", "SCIENCE")
  "socialCategory": "string",       // Social category (e.g., "SEBC", "ST", "SC")
  "score": "number",                // Entrance examination score
  "barcodeNumber": "string",        // Barcode number from results
  "entranceRollNumber": "string",   // Entrance roll number
  "remarks": "string"               // Status remarks (e.g., "PRESENT")
}
```

### Roll Number Format
Roll numbers must follow the pattern: `ED\d{2}A\d{5}`

**Examples:**
- ✅ `ED18A02166` (Valid)
- ✅ `ED19A00123` (Valid)
- ❌ `ED18B02166` (Invalid - should be 'A')
- ❌ `ED1A02166` (Invalid - district code must be 2 digits)

## Error Handling

### Common Error Responses

**Invalid Roll Number Format:**
```json
{
  "success": false,
  "error": "Invalid roll number format",
  "message": "Roll number must match pattern: ED\\d{2}A\\d{5}",
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

**Rate Limit Exceeded:**
```json
{
  "error": "Rate limit exceeded",
  "message": "Maximum 100 requests per 60 seconds allowed",
  "retryAfter": 60
}
```

**No Record Found:**
```json
{
  "success": true,
  "data": {
    "success": false,
    "rollNumber": "ED18A99999",
    "error": "No record found",
    "timestamp": "2025-06-15T16:52:33.972Z",
    "processingTime": 5230
  }
}
```

**Server Error:**
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "timestamp": "2025-06-15T16:52:33.972Z"
}
```

## Rate Limiting

- **Limit:** 100 requests per 60 seconds per IP address
- **Scope:** All `/api/*` endpoints
- **Headers:** Rate limit information included in response headers
- **Exceeded:** Returns 429 status code with retry information

## Performance Guidelines

### Optimal Worker Configuration

Based on performance testing:

| Batch Size | Recommended Workers | Avg Time/Record |
|------------|-------------------|-----------------|
| 1-3 records | 1 worker | ~2,500ms |
| 4-6 records | 2 workers | ~2,800ms |
| 7-15 records | 2-3 workers | ~3,100ms |
| 16+ records | 3-5 workers | ~2,900ms |

### Best Practices

1. **Small Batches**: Use single endpoint for 1-3 roll numbers
2. **Large Batches**: Use batch endpoint with appropriate worker count
3. **Retry Logic**: Implement exponential backoff for failed requests
4. **Timeout**: Set appropriate timeouts (recommended: 30-60 seconds)
5. **Rate Limiting**: Respect rate limits to avoid being blocked

## Examples

### JavaScript/Node.js

```javascript
// Single roll number scraping
const response = await fetch('http://localhost:3000/api/scraper/single', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    rollNumber: 'ED18A02166'
  })
});

const result = await response.json();
console.log(result.data.data); // Student data

// Batch scraping
const batchResponse = await fetch('http://localhost:3000/api/scraper/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    rollNumbers: ['ED18A02166', 'ED18A02167', 'ED18A02168'],
    options: {
      maxWorkers: 2
    }
  })
});

const batchResult = await batchResponse.json();
batchResult.data.results.forEach(student => {
  if (student.success) {
    console.log(`${student.data.name}: ${student.data.score}`);
  }
});
```

### Python

```python
import requests
import json

# Single roll number scraping
url = 'http://localhost:3000/api/scraper/single'
data = {
    'rollNumber': 'ED18A02166'
}

response = requests.post(url, json=data)
result = response.json()

if result['success'] and result['data']['success']:
    student = result['data']['data']
    print(f"Name: {student['name']}")
    print(f"Score: {student['score']}")
    print(f"Course: {student['course']}")

# Batch scraping
batch_url = 'http://localhost:3000/api/scraper/batch'
batch_data = {
    'rollNumbers': ['ED18A02166', 'ED18A02167', 'ED18A02168'],
    'options': {
        'maxWorkers': 2
    }
}

batch_response = requests.post(batch_url, json=batch_data)
batch_result = batch_response.json()

if batch_result['success']:
    for student in batch_result['data']['results']:
        if student['success']:
            data = student['data']
            print(f"{data['name']}: {data['score']} ({data['socialCategory']})")
```

### cURL

```bash
# Single roll number
curl -X POST http://localhost:3000/api/scraper/single \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"ED18A02166"}'

# Batch scraping
curl -X POST http://localhost:3000/api/scraper/batch \
  -H "Content-Type: application/json" \
  -d '{
    "rollNumbers":["ED18A02166","ED18A02167"],
    "options":{"maxWorkers":2}
  }'

# Health check
curl http://localhost:3000/api/scraper/health
```

## SDKs and Libraries

Currently, no official SDKs are available. The API follows REST conventions and can be easily integrated with any HTTP client library.

### Recommended Libraries

**JavaScript/Node.js:**
- `fetch` (built-in)
- `axios`
- `node-fetch`

**Python:**
- `requests`
- `httpx`
- `aiohttp` (async)

**PHP:**
- `Guzzle`
- `cURL`

**Java:**
- `OkHttp`
- `Apache HttpClient`

## Support and Issues

For technical support, bug reports, or feature requests:

1. Check the API health endpoints first
2. Verify your request format matches the documentation
3. Check rate limiting and retry logic
4. Review error messages for specific guidance

## Changelog

### Version 1.0.0
- Initial release
- Single and batch roll number scraping
- Multi-processing support
- Rate limiting
- Comprehensive error handling
- HTML table parsing for complete data extraction
