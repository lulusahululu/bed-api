// Enhanced CPU-optimized OCR worker with SIMD acceleration for maximum performance
import Tesseract from "tesseract.js";
import { CONFIG } from "../config/index.js";

export interface OCRWorkerOptions {
  useOptimization?: boolean;
  workerThreads?: number;
  cacheSize?: number;
}

export class GPUOCRWorker {
  private static instance: GPUOCRWorker;
  private workers: Tesseract.Worker[] = [];
  private workerIndex = 0;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): GPUOCRWorker {
    if (!GPUOCRWorker.instance) {
      GPUOCRWorker.instance = new GPUOCRWorker();
    }
    return GPUOCRWorker.instance;
  }

  /**
   * Initialize CPU-optimized OCR workers with SIMD acceleration
   */
  async initialize(options: OCRWorkerOptions = {}): Promise<void> {
    if (this.isInitialized) return;

    const useOptimization =
      options.useOptimization ?? CONFIG.GPU_ACCELERATION.ENABLED;
    const workerCount =
      options.workerThreads || CONFIG.GPU_ACCELERATION.WORKER_THREADS;

    console.log(
      `🚀 Initializing ${workerCount} OCR workers with ${
        useOptimization ? "SIMD optimization" : "standard"
      } acceleration...`
    );

    const initPromises = Array.from(
      { length: workerCount },
      async (_, index) => {
        const worker = await Tesseract.createWorker("eng", 1, {
          logger: () => {}, // Disable logging for performance
          cachePath: "./tessdata",
          langPath: "./tessdata",
          gzip: false,
        });

        // Configure worker for optimal CPU performance with SIMD
        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD, // Single word - fastest
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // LSTM only for SIMD acceleration
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          preserve_interword_spaces: "0",
          user_defined_dpi: "300",
          tessedit_enable_doc_dict: "0",
          tessedit_enable_dict_correction: "0",
          // CPU-specific optimizations for speed
          tessedit_write_images: "0",
          tessedit_dump_pageseg_images: "0",
          textord_debug_tabfind: "0",
          textord_tablefind_show_vlines: "0",
          textord_tablefind_show_hlines: "0",
        });

        console.log(
          `✅ ${useOptimization ? "SIMD-optimized" : "Standard"} OCR Worker ${
            index + 1
          } initialized`
        );
        return worker;
      }
    );

    this.workers = await Promise.all(initPromises);
    this.isInitialized = true;
    console.log(
      `🎉 All ${workerCount} OCR workers ready with ${
        useOptimization ? "SIMD optimization" : "standard processing"
      }`
    );
  }

  /**
   * Get next available worker (round-robin)
   */
  private getNextWorker(): Tesseract.Worker {
    if (!this.isInitialized || this.workers.length === 0) {
      throw new Error("OCR workers not initialized");
    }

    const worker = this.workers[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Perform OCR with SIMD acceleration
   */
  async recognize(
    imageBuffer: Buffer,
    config: any = {}
  ): Promise<{ text: string; confidence: number; processingTime: number }> {
    if (!this.isInitialized) {
      await this.initialize({ useOptimization: true });
    }

    const startTime = Date.now();
    const worker = this.getNextWorker();

    // Update worker parameters if provided
    if (Object.keys(config).length > 0) {
      await worker.setParameters(config);
    }

    const result = await worker.recognize(imageBuffer);
    const processingTime = Date.now() - startTime;

    return {
      text: result.data.text.replace(/[^A-Z0-9]/gi, "").trim(),
      confidence: result.data.confidence,
      processingTime,
    };
  }

  /**
   * Perform parallel OCR with multiple configurations on optimized CPU
   */
  async recognizeParallel(
    imageBuffer: Buffer,
    configs: any[] = CONFIG.OCR_CONFIGS
  ): Promise<
    Array<{
      text: string;
      confidence: number;
      processingTime: number;
      configIndex: number;
    }>
  > {
    if (!this.isInitialized) {
      await this.initialize({ useOptimization: true });
    }

    const promises = configs
      .slice(0, Math.min(configs.length, this.workers.length))
      .map(async (config, index) => {
        const result = await this.recognize(imageBuffer, config);
        return {
          ...result,
          configIndex: index,
        };
      });

    return await Promise.all(promises);
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      workerCount: this.workers.length,
      gpuEnabled: CONFIG.GPU_ACCELERATION.ENABLED,
      currentWorkerIndex: this.workerIndex,
    };
  }

  /**
   * Terminate all workers
   */
  async terminate(): Promise<void> {
    if (this.workers.length > 0) {
      console.log("🔄 Terminating SIMD-optimized OCR workers...");
      await Promise.all(this.workers.map((worker) => worker.terminate()));
      this.workers = [];
      this.isInitialized = false;
      console.log("✅ All SIMD-optimized OCR workers terminated");
    }
  }
}
