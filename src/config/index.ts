// Configuration for BEd Results Scraper API
export const CONFIG = {
  // Portal settings
  PORTAL_URL: "https://resultsbed.samsodisha.gov.in/ResultBED/BEDSelectionlist",
  MAX_RETRIES: parseInt(process.env.MAX_RETRY_ATTEMPTS || "3"),
  DELAY_BETWEEN_REQUESTS: 2000, // 2 seconds
  TIMEOUT: parseInt(process.env.SCRAPING_TIMEOUT_MS || "30000"),

  // Browser settings
  BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT_MS || "30000"),
  HEADLESS: process.env.HEADLESS_MODE !== "false",

  // Worker settings
  MAX_WORKERS: parseInt(process.env.MAX_WORKERS || "4"),

  // Form field IDs (from working scraper)
  FORM_FIELDS: {
    ROLL_NUMBER: "#txtBarcode",
    CAPTCHA_INPUT: "#captchaInput",
    CAPTCHA_IMAGE: "#imgcode",
    SUBMIT_BUTTON: "#btnSubmit",
    REFRESH_CAPTCHA: "#switchCode",
  },

  // API endpoint for result submission
  RESULT_API_ENDPOINT: "/ResultBED/appstatusbed",

  // OCR settings - optimized for speed and GPU acceleration
  OCR_CONFIGS: [
    // Ultra-fast config with GPU optimization
    {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      tessedit_pageseg_mode: "8", // Single word
      tessedit_ocr_engine_mode: "1", // Neural nets LSTM only (faster)
      preserve_interword_spaces: "0",
      user_defined_dpi: "300",
      tessedit_enable_doc_dict: "0",
      tessedit_enable_dict_correction: "0",
    },
    // Fast config with optimizations
    {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      tessedit_pageseg_mode: "7", // Single text line
      tessedit_ocr_engine_mode: "1",
      preserve_interword_spaces: "0",
      user_defined_dpi: "300",
    },
    // Fallback config
    {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      tessedit_pageseg_mode: "6", // Single uniform block
      tessedit_ocr_engine_mode: "3", // Default + LSTM
    },
  ],

  // GPU acceleration settings - enabled by default for faster OCR
  GPU_ACCELERATION: {
    ENABLED: process.env.GPU_ACCELERATION !== "false", // Default to true
    WEBGL_BACKEND: process.env.WEBGL_BACKEND !== "false",
    WORKER_THREADS: parseInt(process.env.OCR_WORKER_THREADS || "4"), // Increased for better performance
  },

  // Captcha optimization settings
  CAPTCHA_CACHE_SIZE: 100,
  PARALLEL_OCR_ATTEMPTS: 4, // Increased for better accuracy with GPU
  OCR_TIMEOUT: 3000, // Reduced timeout with GPU acceleration

  // Validation
  ROLL_NUMBER_PATTERN: /^ED\d{2}A\d{5}$/,
};
