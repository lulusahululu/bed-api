 // CPU-optimized captcha solving utility with SIMD acceleration
import Tesseract from "tesseract.js";
import { createHash } from "crypto";
import { CONFIG } from "../config/index.js";
import { PerformanceMonitor } from "./performance-monitor.js";
import { ImageProcessor } from "./image-processor.js";
import { GPUOCRWorker } from "./gpu-ocr-worker.js";

interface CaptchaCache {
  [hash: string]: {
    text: string;
    timestamp: number;
    confidence: number;
  };
}

export class OptimizedCaptchaSolver {
  private cache: CaptchaCache = {};
  private cacheHits = 0;
  private cacheMisses = 0;
  private gpuOCRWorker: GPUOCRWorker;

  constructor() {
    this.gpuOCRWorker = GPUOCRWorker.getInstance();
    this.initializeGPU();
  }

  /**
   * Initialize CPU optimization with SIMD
   */
  private async initializeGPU(): Promise<void> {
    await this.gpuOCRWorker.initialize({
      useOptimization: true,
      workerThreads: CONFIG.GPU_ACCELERATION.WORKER_THREADS,
    });
  }

  /**
   * Preprocess image buffer for better OCR accuracy
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    if (!ImageProcessor.isValidImage(imageBuffer)) {
      throw new Error("Invalid image buffer");
    }

    return await ImageProcessor.preprocessForOCR(imageBuffer);
  }

  /**
   * Generate hash for image caching
   */
  private getImageHash(imageBuffer: Buffer): string {
    return createHash("md5").update(imageBuffer).digest("hex");
  }

  /**
   * Clean up old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    Object.keys(this.cache).forEach((hash) => {
      if (now - this.cache[hash].timestamp > maxAge) {
        delete this.cache[hash];
      }
    });

    // Limit cache size
    const entries = Object.entries(this.cache);
    if (entries.length > CONFIG.CAPTCHA_CACHE_SIZE) {
      // Remove oldest entries
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, entries.length - CONFIG.CAPTCHA_CACHE_SIZE)
        .forEach(([hash]) => delete this.cache[hash]);
    }
  }

  /**
   * Solve captcha with GPU-accelerated parallel OCR
   */
  async solveCaptcha(
    imageBuffer: Buffer,
    attempt: number = 1
  ): Promise<string> {
    const startTime = Date.now();
    const imageHash = this.getImageHash(imageBuffer);
    const monitor = PerformanceMonitor.getInstance();

    // Check in-memory cache first
    if (this.cache[imageHash]) {
      this.cacheHits++;
      const cacheTime = Date.now() - startTime;
      console.log(
        `[MEMORY HIT] Using cached result for captcha (${cacheTime}ms)`
      );
      monitor.recordCaptchaAttempt(true, cacheTime);
      return this.cache[imageHash].text;
    }

    this.cacheMisses++;
    console.log(`[SIMD-OCR] Attempt ${attempt} - solving captcha with SIMD acceleration`);

    // Preprocess image
    const processedBuffer = await this.preprocessImage(imageBuffer);

    // Use SIMD-accelerated parallel OCR processing
    console.log(
      `[SIMD-OCR] Processing with ${CONFIG.PARALLEL_OCR_ATTEMPTS} parallel SIMD workers`
    );

    const results = await Promise.race([
      this.gpuOCRWorker.recognizeParallel(
        processedBuffer,
        CONFIG.OCR_CONFIGS.slice(0, CONFIG.PARALLEL_OCR_ATTEMPTS)
      ),
      new Promise<any[]>((_, reject) =>
        setTimeout(
          () => reject(new Error("SIMD OCR timeout")),
          CONFIG.OCR_TIMEOUT
        )
      ),
    ]);

    // Log results
    results.forEach((result, index) => {
      console.log(
        `[SIMD-OCR-${index}] Result: '${result.text}' (${result.processingTime}ms, confidence: ${result.confidence})`
      );
    });

    // Find best result
    const validResults = results.filter(
      (r) => r.text.length >= 3 && r.text.length <= 8
    );

    if (validResults.length === 0) {
      const totalTime = Date.now() - startTime;
      console.log(`[SIMD-OCR] No valid results found (${totalTime}ms)`);
      monitor.recordCaptchaAttempt(false, totalTime);
      return "";
    }

    // Sort by confidence and pick the best
    const bestResult = validResults.sort(
      (a, b) => b.confidence - a.confidence
    )[0];

    // Cache the result if confidence is reasonable
    if (bestResult.confidence > 40 && bestResult.text.length >= 3) {
      const cacheResult = {
        text: bestResult.text,
        timestamp: Date.now(),
        confidence: bestResult.confidence,
      };

      // Store in memory cache
      this.cache[imageHash] = cacheResult;

      // Clean memory cache periodically
      if (Object.keys(this.cache).length % 10 === 0) {
        this.cleanCache();
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `[SIMD-OCR] Best result: '${bestResult.text}' (confidence: ${bestResult.confidence}, ${totalTime}ms)`
    );

    // Record performance metrics
    monitor.recordCaptchaAttempt(true, totalTime);

    return bestResult.text;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return {
      memory: {
        cacheSize: Object.keys(this.cache).length,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        hitRate:
          this.cacheHits > 0
            ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100
            : 0,
      },
      gpu: {
        enabled: CONFIG.GPU_ACCELERATION.ENABLED,
        isInitialized: this.gpuOCRWorker.getStats().isInitialized,
        workerCount: this.gpuOCRWorker.getStats().workerCount,
        currentWorkerIndex: this.gpuOCRWorker.getStats().currentWorkerIndex,
      },
      overall: {
        totalHits: this.cacheHits,
        totalMisses: this.cacheMisses,
        overallHitRate:
          this.cacheHits > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 : 0,
      },
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    // Clear memory cache
    this.cache = {};
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Terminate GPU OCR workers (for cleanup)
   */
  async terminate(): Promise<void> {
    await this.gpuOCRWorker.terminate();
  }
}
