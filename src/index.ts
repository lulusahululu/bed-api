import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import scraperRoutes from "./routes/scraper.js";
import { requestLogger, rateLimiting } from "./utils/helpers.js";
import "dotenv/config";

const app = new Hono();

// Environment variables
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_WINDOW_MS || "60000"
);
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_MAX_REQUESTS || "500"
);
const DISABLE_RATE_LIMITING = process.env.DISABLE_RATE_LIMITING === "true";

// Middleware
app.use(
  "*",
  cors({
    origin: NODE_ENV === "development" ? "*" : [], // Configure for production
    credentials: false,
  })
);
app.use("*", logger());
app.use("*", prettyJSON());
app.use("*", requestLogger);

// Rate limiting (apply to API routes only, skip if disabled)
if (!DISABLE_RATE_LIMITING) {
  app.use(
    "/api/*",
    rateLimiting(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)
  );
  console.log(
    `🛡️  Rate limiting enabled: ${RATE_LIMIT_MAX_REQUESTS} requests per ${
      RATE_LIMIT_WINDOW_MS / 1000
    }s`
  );
} else {
  console.log("⚠️  Rate limiting disabled");
}

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "BEd Results Scraper API",
    version: "1.0.0",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/",
      scraper: "/api/scraper",
      info: "/api/scraper/info",
    },
  });
});

// API Routes
app.route("/api/scraper", scraperRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: "The requested endpoint does not exist",
      availableEndpoints: [
        "GET /",
        "GET /api/scraper/info",
        "GET /api/scraper/health",
        "POST /api/scraper/single",
        "POST /api/scraper/batch",
        "GET /api/scraper/test",
      ],
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message:
        NODE_ENV === "development"
          ? err.message
          : "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    },
    500
  );
});

// Start server
async function startServer() {
  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      console.log(
        `🚀 BEd Results Scraper API is running on http://localhost:${info.port}`
      );
      console.log(`📊 Environment: ${NODE_ENV}`);
      if (!DISABLE_RATE_LIMITING) {
        console.log(
          `🛡️  Rate limiting: ${RATE_LIMIT_MAX_REQUESTS} requests per ${
            RATE_LIMIT_WINDOW_MS / 1000
          }s`
        );
      }
      console.log(`📊 Health check: http://localhost:${info.port}`);
      console.log(
        `🔍 Scraper endpoints: http://localhost:${info.port}/api/scraper`
      );
      console.log(
        `📖 API info: http://localhost:${info.port}/api/scraper/info`
      );
      console.log(
        `🔄 Performance metrics: http://localhost:${info.port}/api/scraper/performance`
      );
    }
  );
}

startServer();
