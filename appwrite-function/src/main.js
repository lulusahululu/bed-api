// Appwrite Function for BEd Results Scraper
import { Hono } from 'hono';

const app = new Hono();

// Simple in-memory rate limiting for Appwrite
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const RATE_LIMIT_MAX = 50; // requests per window

function checkRateLimit(clientIP) {
  const now = Date.now();
  const clientKey = clientIP || 'unknown';
  
  if (!rateLimitStore.has(clientKey)) {
    rateLimitStore.set(clientKey, []);
  }
  
  const requests = rateLimitStore.get(clientKey);
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitStore.set(clientKey, validRequests);
  return true;
}

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'BEd Results Scraper API - Appwrite Function',
    version: '1.0.0',
    platform: 'appwrite-functions',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/',
      single: '/single',
      info: '/info'
    }
  });
});

// API Info
app.get('/info', (c) => {
  return c.json({
    success: true,
    data: {
      name: 'BEd Results Scraper API',
      version: '1.0.0',
      platform: 'Appwrite Functions',
      description: 'Scraping API for BEd results from SAMS Odisha portal',
      endpoints: {
        'GET /': 'Health check',
        'GET /info': 'API information', 
        'POST /single': 'Scrape single roll number',
        'POST /validate': 'Validate roll number format'
      },
      limitations: [
        'Browser automation not available in Appwrite environment',
        'Limited to API-based scraping methods',
        'Rate limited to 50 requests per minute'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Roll number validation
app.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { rollNumber } = body;
    
    if (!rollNumber) {
      return c.json({
        success: false,
        error: 'Roll number is required'
      }, 400);
    }
    
    const rollNumberPattern = /^ED\d{2}A\d{5}$/;
    const isValid = rollNumberPattern.test(rollNumber);
    
    return c.json({
      success: true,
      data: {
        rollNumber,
        isValid,
        format: 'ED##A#####',
        example: 'ED18A02166'
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Invalid request body'
    }, 400);
  }
});

// Simplified single roll number endpoint (without browser automation)
app.post('/single', async (c) => {
  try {
    const clientIP = c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     'unknown';
    
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return c.json({
        error: 'Rate limit exceeded',
        message: 'Maximum 50 requests per minute allowed',
        retryAfter: 60
      }, 429);
    }
    
    const body = await c.req.json();
    const { rollNumber } = body;
    
    if (!rollNumber) {
      return c.json({
        success: false,
        error: 'Roll number is required'
      }, 400);
    }
    
    // Validate roll number format
    const rollNumberPattern = /^ED\d{2}A\d{5}$/;
    if (!rollNumberPattern.test(rollNumber)) {
      return c.json({
        success: false,
        error: 'Invalid roll number format',
        message: 'Roll number must match pattern: ED##A##### (e.g., ED18A02166)'
      }, 400);
    }
    
    // Note: In Appwrite Functions, we can't use Playwright/browser automation
    // This would need to be replaced with direct API calls or alternative methods
    return c.json({
      success: true,
      data: {
        success: false,
        rollNumber,
        error: 'Browser automation not available in Appwrite Functions environment',
        message: 'This function requires deployment to a server with browser support',
        alternatives: [
          'Deploy to a VPS or cloud server',
          'Use Vercel/Netlify with custom runtime',
          'Implement API-only scraping method'
        ],
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Function error:', err);
  return c.json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: ['/', '/info', '/single', '/validate']
  }, 404);
});

// Appwrite Function entry point
export default async ({ req, res, log, error }) => {
  try {
    log('BEd Results Scraper Function called');
    
    // Convert Appwrite request to standard request
    const url = new URL(req.url || '', 'https://example.com');
    const method = req.method || 'GET';
    const headers = req.headers || {};
    const body = req.body || '';
    
    // Create a Request object compatible with Hono
    const request = new Request(url, {
      method,
      headers: new Headers(headers),
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined
    });
    
    // Process with Hono app
    const response = await app.fetch(request);
    const responseBody = await response.text();
    
    log(`Response: ${response.status} - ${responseBody.substring(0, 100)}...`);
    
    return res.json(JSON.parse(responseBody), response.status);
    
  } catch (err) {
    error('Function execution failed:', err);
    return res.json({
      success: false,
      error: 'Function execution failed',
      message: err.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
};
