// Core scraping engine adapted for Hono API
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { existsSync } from "fs";
import type {
  ScrapingOptions,
  ScrapingResult,
  StudentData,
} from "../types/index.js";
import { CONFIG } from "../config/index.js";
import { OptimizedCaptchaSolver } from "../utils/captcha-solver.js";

export class BedResultsScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private maxRetries: number;
  private headless: boolean;
  private timeout: number;
  private captchaSolver: OptimizedCaptchaSolver;

  constructor(options: ScrapingOptions = {}) {
    this.maxRetries = options.maxRetries || CONFIG.MAX_RETRIES;
    this.headless = options.headless ?? CONFIG.HEADLESS;
    this.timeout = options.timeout || CONFIG.TIMEOUT;
    this.captchaSolver = new OptimizedCaptchaSolver();
  }

  async initialize(): Promise<void> {
    console.log("🔄 Launching browser...");

    // Determine executable path based on environment
    const getChromiumPath = () => {
      // If running in Docker/Alpine container
      if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
        return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      }

      // Check if Alpine chromium exists (Docker environment)
      if (existsSync("/usr/bin/chromium")) {
        return "/usr/bin/chromium";
      }

      // For local development, let Playwright find its own browser
      return undefined;
    };

    const launchOptions: any = {
      headless: this.headless,
      timeout: this.timeout,
      devtools: false,
    };

    const executablePath = getChromiumPath();
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.browser = await chromium.launch(launchOptions);
    console.log("✅ Browser launched successfully");
    this.page = await this.browser.newPage();
    await this.loadPortal();
  }

  private async loadPortal(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    await this.page.goto(CONFIG.PORTAL_URL, {
      waitUntil: "networkidle",
      timeout: this.timeout,
    });
    console.log("✅ Portal loaded successfully");
  }

  private async solveCaptcha(
    imageBuffer: Buffer,
    attempt: number = 1
  ): Promise<string> {
    return await this.captchaSolver.solveCaptcha(imageBuffer, attempt);
  }

  async scrapeRollNumber(rollNumber: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let lastError = "";

    console.log(`🚀 Processing roll number: ${rollNumber}`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      console.log(
        `[SIMD-OCR] Attempt ${attempt}/${this.maxRetries} for ${rollNumber}`
      );

      if (!this.page) {
        await this.initialize();
      }

      if (!this.page) {
        lastError = "Failed to initialize page";
        console.error(`[SIMD-OCR] Error on attempt ${attempt}:`, lastError);
        if (attempt === this.maxRetries) break;
        continue;
      }

      // Clear previous inputs using the correct field IDs
      await this.page.fill(CONFIG.FORM_FIELDS.ROLL_NUMBER, "");
      await this.page.fill(CONFIG.FORM_FIELDS.CAPTCHA_INPUT, "");

      // Enter roll number
      await this.page.fill(CONFIG.FORM_FIELDS.ROLL_NUMBER, rollNumber);

      // Wait for captcha image to load
      await this.page.waitForSelector(CONFIG.FORM_FIELDS.CAPTCHA_IMAGE);

      // Get captcha image using correct selector
      const captchaElement = await this.page.$(
        CONFIG.FORM_FIELDS.CAPTCHA_IMAGE
      );
      if (!captchaElement) {
        lastError = "Captcha element not found";
        console.error(`[SIMD-OCR] Error on attempt ${attempt}:`, lastError);
        if (attempt === this.maxRetries) break;
        continue;
      }

      const captchaBuffer = await captchaElement.screenshot();

      // Solve captcha with SIMD-accelerated solver
      const captchaText = await this.solveCaptcha(captchaBuffer, attempt);

      // If OCR fails, refresh and retry quickly
      if (!captchaText || captchaText.length < 3) {
        console.log(
          `[SIMD-OCR] OCR failed for ${rollNumber}, attempt ${attempt}. Retrying...`
        );
        // Refresh captcha with minimal delay
        await this.page.click(CONFIG.FORM_FIELDS.REFRESH_CAPTCHA);
        await this.page.waitForTimeout(500);
        continue;
      }

      // Fill captcha
      await this.page.fill(CONFIG.FORM_FIELDS.CAPTCHA_INPUT, captchaText);

      // Submit form and wait for API response
      const responsePromise = this.page.waitForResponse(
        (response) =>
          response.url().includes(CONFIG.RESULT_API_ENDPOINT) &&
          response.status() === 200
      );

      await this.page.click(CONFIG.FORM_FIELDS.SUBMIT_BUTTON);
      const response = await responsePromise;
      const result = await response.json();

      // Process API response
      if (result.state === "success") {
        console.log(
          "✅ Result found successfully! Roll Number: " + rollNumber
        );

        // Also parse the HTML table for additional data
        const tableData = await this.parseResultsTable();

        return {
          success: true,
          rollNumber,
          data: this.transformApiResponse(result.data, rollNumber, tableData),
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
        };
      } else if (result.message === "No record found") {
        console.log("❌ No record found for this roll number: " + rollNumber);
        return {
          success: false,
          rollNumber,
          error: "No record found",
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
        };
      } else {
        console.log("[SIMD-OCR] Invalid captcha, retrying...");
        // Clear captcha input and refresh with minimal delay
        await this.page.fill(CONFIG.FORM_FIELDS.CAPTCHA_INPUT, "");
        await this.page.click(CONFIG.FORM_FIELDS.REFRESH_CAPTCHA);
        await this.page.waitForTimeout(300);
      }
    }

    return {
      success: false,
      rollNumber,
      error: `Failed after ${this.maxRetries} attempts: ${lastError}`,
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Parse results table from HTML
   */
  private async parseResultsTable(): Promise<any> {
    // Wait for the results table to appear
    await this.page?.waitForSelector("#dataContainer table", {
      timeout: 5000,
    });

    // Extract table data
    const tableData = await this.page?.evaluate(() => {
      const table = document.querySelector("#dataContainer table tbody tr");
      if (!table) return null;

      const cells = table.querySelectorAll("td");
      if (cells.length < 9) return null;

      return {
        barcodeNumber: cells[0]?.textContent?.trim() || "",
        entranceRollNumber: cells[1]?.textContent?.trim() || "",
        applicantName: cells[2]?.textContent?.trim() || "",
        entranceScore: cells[3]?.textContent?.trim() || "",
        course: cells[4]?.textContent?.trim() || "",
        stream: cells[5]?.textContent?.trim() || "",
        socialCategory: cells[6]?.textContent?.trim() || "",
        remarks: cells[8]?.textContent?.trim() || "",
      };
    });

    return tableData;
  }

  private transformApiResponse(
    apiData: any,
    rollNumber: string,
    tableData?: any
  ): StudentData {
    // Transform the API response data into our StudentData format
    // Combine with table data if available for more complete information
    return {
      rollNumber,
      name: tableData?.applicantName || apiData.vchApplicantName || "",
      course: tableData?.course || apiData.vchCourse || "",
      stream: tableData?.stream || apiData.vchStream || "",
      socialCategory:
        tableData?.socialCategory || apiData.vchSocialCategory || "",
      score: parseFloat(
        tableData?.entranceScore || apiData.vchPreference || "0"
      ),
      // Additional fields from table data
      barcodeNumber: tableData?.barcodeNumber || "",
      entranceRollNumber: tableData?.entranceRollNumber || rollNumber,
      remarks: tableData?.remarks || "",
    };
  }

  /**
   * Get captcha solver performance statistics
   */
  async getCaptchaStats() {
    return await this.captchaSolver.getCacheStats();
  }

  /**
   * Clear captcha cache (useful for testing)
   */
  async clearCaptchaCache(): Promise<void> {
    await this.captchaSolver.clearCache();
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;

      // Log captcha performance stats
      const stats = await this.getCaptchaStats();
      console.log(`🔄 Browser closed - SIMD OCR cache stats:`, stats);
    }
  }
}
