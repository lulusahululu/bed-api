// Utility functions for the BEd Results Scraper API
import type { Context, Next } from 'hono';

export function validateRollNumber(rollNumber: string): boolean {
  // Basic validation for BEd roll number format
  // Expected format: EDxxAxxxxx (e.g., ED18A02166)
  const rollNumberPattern = /^ED\d{2}A\d{5}$/;
  return rollNumberPattern.test(rollNumber);
}

export function sanitizeRollNumber(rollNumber: string): string {
  // Remove any whitespace and convert to uppercase
  return rollNumber.trim().toUpperCase();
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function formatProcessingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

export function getOptimalWorkerCount(totalTasks: number, maxWorkers: number = 4): number {
  if (totalTasks <= 3) return 1;
  if (totalTasks <= 10) return 2;
  if (totalTasks <= 25) return 3;
  return Math.min(maxWorkers, Math.ceil(totalTasks / 10));
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number = 60000, maxRequests: number = 500) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    
    // Clean up old entries every 30 seconds to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000);
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, [now]);
      return true;
    }

    const requests = this.requests.get(identifier)!;
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      return this.maxRequests;
    }

    const requests = this.requests.get(identifier)!;
    const validRequests = requests.filter(time => time > windowStart);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(identifier: string): number {
    if (!this.requests.has(identifier)) {
      return 0;
    }

    const requests = this.requests.get(identifier)!;
    if (requests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}

export function createResponseHeaders(processingTime?: number) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0.0',
    'X-Powered-By': 'BEd-Results-Scraper-API'
  };

  if (processingTime !== undefined) {
    headers['X-Processing-Time'] = `${processingTime}ms`;
  }

  return headers;
}

export function logRequest(method: string, path: string, status: number, processingTime: number) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${method} ${path} - ${status} (${formatProcessingTime(processingTime)})`);
}

// Hono middleware for custom request logging
export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  
  await next();
  
  const processingTime = Date.now() - start;
  const status = c.res.status;
  logRequest(method, path, status, processingTime);
}

// Hono middleware for rate limiting
export function rateLimiting(windowMs: number = 60000, maxRequests: number = 500) {
  const limiter = new RateLimiter(windowMs, maxRequests);
  
  return async (c: Context, next: Next) => {
    // In development, be more lenient with rate limiting
    const isDevelopment = process.env.NODE_ENV === 'development';
    const effectiveMaxRequests = isDevelopment ? maxRequests * 2 : maxRequests;
    
    const clientIP = c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     c.req.header('cf-connecting-ip') ||
                     'unknown';
    
    // Create a more specific identifier for rate limiting
    const userAgent = c.req.header('user-agent') || 'unknown';
    const identifier = `${clientIP}-${userAgent.substring(0, 50)}`;
    
    if (!limiter.isAllowed(identifier)) {
      const remaining = limiter.getRemainingRequests(identifier);
      const resetTime = limiter.getResetTime(identifier);
      
      // Add rate limit headers
      c.res.headers.set('X-RateLimit-Limit', maxRequests.toString());
      c.res.headers.set('X-RateLimit-Remaining', remaining.toString());
      c.res.headers.set('X-RateLimit-Reset', resetTime.toString());
      
      return c.json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Maximum ${effectiveMaxRequests} requests per ${windowMs / 1000} seconds allowed`,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        remaining: remaining,
        resetTime: new Date(resetTime).toISOString()
      }, 429);
    }
    
    // Add rate limit info to successful requests
    const remaining = limiter.getRemainingRequests(identifier);
    c.res.headers.set('X-RateLimit-Limit', effectiveMaxRequests.toString());
    c.res.headers.set('X-RateLimit-Remaining', remaining.toString());
    
    await next();
  };
}

// Validation middleware for request bodies
export function validateScrapingRequest(c: Context, next: Next) {
  const body = c.req.json();
  // Add validation logic here based on request type
  return next();
}
