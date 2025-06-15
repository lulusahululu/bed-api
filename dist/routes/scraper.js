// API routes for the BEd Results Scraper
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { BedResultsScraper } from '../core/scraper.js';
import { ScrapingClusterManager } from '../core/cluster-manager.js';
const app = new Hono();
// Middleware
app.use('*', cors());
app.use('*', logger());
app.use('*', timing());
// Health check endpoint
app.get('/health', (c) => {
    return c.json({
        success: true,
        message: 'BEd Results Scraper API is running',
        timestamp: new Date().toISOString()
    });
});
// API info endpoint
app.get('/info', (c) => {
    return c.json({
        success: true,
        data: {
            name: 'BEd Results Scraper API',
            version: '1.0.0',
            description: 'Fast, multi-processing API for scraping BEd results from SAMS Odisha portal',
            endpoints: {
                'GET /health': 'Health check',
                'GET /info': 'API information',
                'POST /single': 'Scrape single roll number',
                'POST /batch': 'Scrape multiple roll numbers (with clustering)',
                'GET /test': 'Test scraping with sample roll number'
            }
        },
        timestamp: new Date().toISOString()
    });
});
// Single roll number scraping
app.post('/single', async (c) => {
    try {
        const body = await c.req.json();
        const { rollNumber, options = {} } = body;
        if (!rollNumber || typeof rollNumber !== 'string') {
            return c.json({
                success: false,
                error: 'Roll number is required and must be a string',
                timestamp: new Date().toISOString()
            }, 400);
        }
        const scraper = new BedResultsScraper(options);
        try {
            await scraper.initialize();
            const result = await scraper.scrapeRollNumber(rollNumber);
            return c.json({
                success: true,
                data: result,
                timestamp: new Date().toISOString()
            });
        }
        finally {
            await scraper.close();
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Single scrape error:', errorMessage);
        return c.json({
            success: false,
            error: `Scraping failed: ${errorMessage}`,
            timestamp: new Date().toISOString()
        }, 500);
    }
});
// Batch roll number scraping with clustering
app.post('/batch', async (c) => {
    try {
        const body = await c.req.json();
        const { rollNumbers, options = {} } = body;
        if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) {
            return c.json({
                success: false,
                error: 'rollNumbers must be a non-empty array',
                timestamp: new Date().toISOString()
            }, 400);
        }
        if (rollNumbers.length > 100) {
            return c.json({
                success: false,
                error: 'Maximum 100 roll numbers allowed per batch',
                timestamp: new Date().toISOString()
            }, 400);
        }
        // Validate all roll numbers are strings
        const invalidRollNumbers = rollNumbers.filter(rn => typeof rn !== 'string' || !rn.trim());
        if (invalidRollNumbers.length > 0) {
            return c.json({
                success: false,
                error: 'All roll numbers must be non-empty strings',
                timestamp: new Date().toISOString()
            }, 400);
        }
        const startTime = Date.now();
        const clusterManager = new ScrapingClusterManager();
        const results = await clusterManager.scrapeMultiple(rollNumbers, options);
        const processingTime = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const errors = results
            .filter(r => !r.success)
            .map(r => `${r.rollNumber}: ${r.error}`);
        const response = {
            success: true,
            total: rollNumbers.length,
            completed: results.length,
            results,
            errors,
            processingTime
        };
        return c.json({
            success: true,
            data: response,
            message: `Processed ${results.length}/${rollNumbers.length} roll numbers (${successCount} successful)`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Batch scrape error:', errorMessage);
        return c.json({
            success: false,
            error: `Batch scraping failed: ${errorMessage}`,
            timestamp: new Date().toISOString()
        }, 500);
    }
});
// Test endpoint with a known working roll number
app.get('/test', async (c) => {
    const testRollNumber = 'ED18A02166'; // Known working roll number
    try {
        const scraper = new BedResultsScraper({ headless: true });
        try {
            await scraper.initialize();
            const result = await scraper.scrapeRollNumber(testRollNumber);
            return c.json({
                success: true,
                data: result,
                message: `Test scraping completed for roll number: ${testRollNumber}`,
                timestamp: new Date().toISOString()
            });
        }
        finally {
            await scraper.close();
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Test scrape error:', errorMessage);
        return c.json({
            success: false,
            error: `Test scraping failed: ${errorMessage}`,
            timestamp: new Date().toISOString()
        }, 500);
    }
});
// Error handling middleware
app.onError((err, c) => {
    console.error('Unhandled error:', err);
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
        message: 'Check /info for available endpoints',
        timestamp: new Date().toISOString()
    }, 404);
});
export default app;
