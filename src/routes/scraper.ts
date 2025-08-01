// API routes for the BEd Results Scraper
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { timing } from "hono/timing";
import { BedResultsScraper } from "../core/scraper.js";
import { ScrapingClusterManager } from "../core/cluster-manager.js";
import { PerformanceMonitor } from "../utils/performance-monitor.js";
import type {
  ScrapingOptions,
  BatchScrapingRequest,
  BatchScrapingResponse,
  APIResponse,
} from "../types/index.js";

const app = new Hono();

// Middleware
app.use("*", cors());
app.use("*", logger());
app.use("*", timing());

// Health check endpoint
app.get("/health", (c) => {
  return c.json<APIResponse>({
    success: true,
    message: "BEd Results Scraper API is running",
    timestamp: new Date().toISOString(),
  });
});

// API info endpoint
app.get("/info", (c) => {
  return c.json<APIResponse>({
    success: true,
    data: {
      name: "BEd Results Scraper API",
      version: "1.0.0",
      description:
        "Fast, multi-processing API for scraping BEd results from SAMS Odisha portal",
      endpoints: {
        "GET /health": "Health check",
        "GET /info": "API information",
        "GET /performance": "Captcha solving performance metrics",
        "DELETE /cache": "Clear captcha cache",
        "POST /single": "Scrape single roll number (browser-based)",
        "POST /batch": "Scrape multiple roll numbers (with clustering)",
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Performance metrics endpoint
app.get("/performance", async (c) => {
  const monitor = PerformanceMonitor.getInstance();
  const metrics = monitor.getMetrics();

  return c.json<APIResponse>({
    success: true,
    data: {
      captchaPerformance: metrics,
      recommendations: {
        averageTimeStatus:
          metrics.averageCaptchaTime < 3000
            ? "Good"
            : metrics.averageCaptchaTime < 5000
            ? "Fair"
            : "Needs Improvement",
        successRateStatus:
          metrics.successRate > 80
            ? "Excellent"
            : metrics.successRate > 60
            ? "Good"
            : "Needs Improvement",
        tips: [
          metrics.averageCaptchaTime > 5000
            ? "Consider optimizing OCR settings or enable GPU acceleration"
            : null,
          metrics.successRate < 60
            ? "Check captcha image quality and OCR configuration"
            : null,
        ].filter(Boolean),
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Clear cache endpoint
app.delete("/cache", async (c) => {
  // Reset performance monitor
  const monitor = PerformanceMonitor.getInstance();
  monitor.reset();

  return c.json<APIResponse>({
    success: true,
    data: {
      message: "Cache cleared successfully",
    },
    timestamp: new Date().toISOString(),
  });
});

// Single roll number scraping
app.post("/single", async (c) => {
  const body = await c.req.json();
  const {
    rollNumber,
    options = {},
  }: { rollNumber: string; options?: ScrapingOptions } = body;

  if (!rollNumber || typeof rollNumber !== "string") {
    return c.json<APIResponse>(
      {
        success: false,
        error: "Roll number is required and must be a string",
        timestamp: new Date().toISOString(),
      },
      400
    );
  }

  const scraper = new BedResultsScraper(options);

  await scraper.initialize();
  const result = await scraper.scrapeRollNumber(rollNumber);
  await scraper.close();

  return c.json<APIResponse>({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  });
});

// Batch roll number scraping with clustering
app.post("/batch", async (c) => {
  const body = await c.req.json();
  const { rollNumbers, options = {} }: BatchScrapingRequest = body;

  if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) {
    return c.json<APIResponse>(
      {
        success: false,
        error: "rollNumbers must be a non-empty array",
        timestamp: new Date().toISOString(),
      },
      400
    );
  }

  if (rollNumbers.length > 100) {
    return c.json<APIResponse>(
      {
        success: false,
        error: "Maximum 100 roll numbers allowed per batch",
        timestamp: new Date().toISOString(),
      },
      400
    );
  }

  // Validate all roll numbers are strings
  const invalidRollNumbers = rollNumbers.filter(
    (rn) => typeof rn !== "string" || !rn.trim()
  );
  if (invalidRollNumbers.length > 0) {
    return c.json<APIResponse>(
      {
        success: false,
        error: "All roll numbers must be non-empty strings",
        timestamp: new Date().toISOString(),
      },
      400
    );
  }

  const startTime = Date.now();
  const clusterManager = new ScrapingClusterManager();

  const results = await clusterManager.scrapeMultiple(rollNumbers, options);
  const processingTime = Date.now() - startTime;

  const successCount = results.filter((r) => r.success).length;
  const errors = results
    .filter((r) => !r.success)
    .map((r) => `${r.rollNumber}: ${r.error}`);

  const response: BatchScrapingResponse = {
    success: true,
    total: rollNumbers.length,
    completed: results.length,
    results,
    errors,
    processingTime,
  };

  return c.json<APIResponse>({
    success: true,
    data: response,
    message: `Processed ${results.length}/${rollNumbers.length} roll numbers (${successCount} successful)`,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.onError((err, c) => {
  console.error("Unhandled error:", err);

  return c.json<APIResponse>(
    {
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json<APIResponse>(
    {
      success: false,
      error: "Endpoint not found",
      message: "Check /info for available endpoints",
      timestamp: new Date().toISOString(),
    },
    404
  );
});

export default app;
