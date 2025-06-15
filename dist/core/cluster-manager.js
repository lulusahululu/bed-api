// Multi-processing manager using Node.js cluster
import cluster from 'node:cluster';
import { cpus } from 'node:os';
export class ScrapingClusterManager {
    workers = new Map();
    workerQueue = [];
    maxWorkers;
    constructor(maxWorkers) {
        this.maxWorkers = maxWorkers || Math.min(cpus().length, 4); // Limit to 4 workers max
    }
    async scrapeMultiple(rollNumbers, options = {}) {
        if (rollNumbers.length === 0)
            return [];
        // If single roll number or small batch, don't use clustering
        if (rollNumbers.length <= 3) {
            return this.scrapeSingle(rollNumbers, options);
        }
        const chunkSize = Math.ceil(rollNumbers.length / this.maxWorkers);
        const chunks = this.chunkArray(rollNumbers, chunkSize);
        console.log(`Processing ${rollNumbers.length} roll numbers using ${chunks.length} workers`);
        const promises = chunks.map((chunk, index) => this.createWorkerPromise(chunk, index, options));
        try {
            const workerResults = await Promise.all(promises);
            const allResults = [];
            for (const workerResult of workerResults) {
                allResults.push(...workerResult.results);
            }
            return allResults;
        }
        catch (error) {
            console.error('Cluster processing error:', error);
            // Fallback to single-threaded processing
            return this.scrapeSingle(rollNumbers, options);
        }
    }
    async scrapeSingle(rollNumbers, options) {
        // Import dynamically to avoid circular imports
        const { BedResultsScraper } = await import('./scraper.js');
        const scraper = new BedResultsScraper(options);
        try {
            await scraper.initialize();
            const results = [];
            for (const rollNumber of rollNumbers) {
                try {
                    const result = await scraper.scrapeRollNumber(rollNumber);
                    results.push(result);
                    // Add delay between requests
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        success: false,
                        rollNumber,
                        error: errorMessage,
                        timestamp: new Date().toISOString(),
                        processingTime: 0
                    });
                }
            }
            return results;
        }
        finally {
            await scraper.close();
        }
    }
    async createWorkerPromise(rollNumbers, workerId, options) {
        return new Promise((resolve, reject) => {
            const worker = cluster.fork();
            worker.on('message', (result) => {
                resolve(result);
                worker.kill();
            });
            worker.on('error', (error) => {
                console.error(`Worker ${workerId} error:`, error);
                reject(error);
            });
            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker ${workerId} exited with code ${code}`));
                }
            });
            // Send work to worker
            const workerData = {
                rollNumbers,
                workerId,
                options
            };
            worker.send(workerData);
        });
    }
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
}
// Worker process logic
export async function runWorker() {
    process.on('message', async (data) => {
        const { rollNumbers, workerId, options } = data;
        const startTime = Date.now();
        try {
            // Import scraper in worker
            const { BedResultsScraper } = await import('./scraper.js');
            const scraper = new BedResultsScraper(options);
            await scraper.initialize();
            const results = [];
            for (const rollNumber of rollNumbers) {
                try {
                    const result = await scraper.scrapeRollNumber(rollNumber);
                    results.push(result);
                    // Longer delay in workers to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        success: false,
                        rollNumber,
                        error: errorMessage,
                        timestamp: new Date().toISOString(),
                        processingTime: 0
                    });
                }
            }
            await scraper.close();
            const workerResult = {
                workerId,
                results,
                processingTime: Date.now() - startTime
            };
            process.send(workerResult);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Worker ${workerId} failed:`, errorMessage);
            // Send error results
            const errorResults = rollNumbers.map(rollNumber => ({
                success: false,
                rollNumber,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                processingTime: 0
            }));
            const workerResult = {
                workerId,
                results: errorResults,
                processingTime: Date.now() - startTime
            };
            process.send(workerResult);
        }
    });
}
// Check if this is a worker process
if (!cluster.isPrimary) {
    runWorker();
}
