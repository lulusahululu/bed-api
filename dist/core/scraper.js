// Core scraping engine adapted for Hono API
import { chromium } from 'playwright';
import Tesseract from 'tesseract.js';
import { CONFIG } from '../config/index.js';
export class BedResultsScraper {
    browser = null;
    page = null;
    maxRetries;
    headless;
    timeout;
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || CONFIG.MAX_RETRIES;
        this.headless = options.headless ?? CONFIG.HEADLESS;
        this.timeout = options.timeout || CONFIG.TIMEOUT;
    }
    async initialize() {
        try {
            console.log('🔄 Launching browser...');
            this.browser = await chromium.launch({
                headless: this.headless,
                timeout: this.timeout,
                devtools: false
            });
            console.log('✅ Browser launched successfully');
            this.page = await this.browser.newPage();
            await this.loadPortal();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to initialize scraper: ${errorMessage}`);
        }
    }
    async loadPortal() {
        if (!this.page)
            throw new Error('Page not initialized');
        await this.page.goto(CONFIG.PORTAL_URL, {
            waitUntil: 'networkidle',
            timeout: this.timeout
        });
        console.log('✅ Portal loaded successfully');
    }
    async solveCaptcha(imageBuffer, attempt = 1) {
        console.log(`[DEBUG] OCR attempt ${attempt} for captcha`);
        try {
            const config = CONFIG.OCR_CONFIGS[Math.min(attempt - 1, CONFIG.OCR_CONFIGS.length - 1)];
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: () => { }, // Disable logging
                ...config
            });
            const cleanText = text.replace(/[^A-Z0-9]/gi, '').trim();
            console.log(`[DEBUG] OCR result: '${cleanText}'`);
            return cleanText;
        }
        catch (error) {
            console.error(`[DEBUG] OCR error on attempt ${attempt}:`, error instanceof Error ? error.message : 'Unknown error');
            return '';
        }
    }
    async scrapeRollNumber(rollNumber) {
        const startTime = Date.now();
        let lastError = '';
        console.log(`🚀 Processing roll number: ${rollNumber}`);
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            console.log(`[DEBUG] Attempt ${attempt}/${this.maxRetries} for ${rollNumber}`);
            try {
                if (!this.page) {
                    await this.initialize();
                }
                if (!this.page) {
                    throw new Error('Failed to initialize page');
                }
                // Clear previous inputs using the correct field IDs
                await this.page.fill(CONFIG.FORM_FIELDS.ROLL_NUMBER, '');
                await this.page.fill(CONFIG.FORM_FIELDS.CAPTCHA_INPUT, '');
                // Enter roll number
                await this.page.fill(CONFIG.FORM_FIELDS.ROLL_NUMBER, rollNumber);
                // Wait for captcha image to load
                await this.page.waitForSelector(CONFIG.FORM_FIELDS.CAPTCHA_IMAGE);
                // Get captcha image using correct selector
                const captchaElement = await this.page.$(CONFIG.FORM_FIELDS.CAPTCHA_IMAGE);
                if (!captchaElement)
                    throw new Error('Captcha element not found');
                const captchaBuffer = await captchaElement.screenshot();
                // Solve captcha
                const captchaText = await this.solveCaptcha(captchaBuffer, attempt);
                // If OCR fails, skip this attempt
                if (!captchaText || captchaText.length < 3) {
                    console.log(`[DEBUG] OCR failed for ${rollNumber}, attempt ${attempt}. Retrying...`);
                    // Refresh captcha
                    await this.page.click(CONFIG.FORM_FIELDS.REFRESH_CAPTCHA);
                    await this.page.waitForTimeout(1000);
                    continue;
                }
                // Fill captcha
                await this.page.fill(CONFIG.FORM_FIELDS.CAPTCHA_INPUT, captchaText);
                // Submit form and wait for API response
                const responsePromise = this.page.waitForResponse(response => response.url().includes(CONFIG.RESULT_API_ENDPOINT) && response.status() === 200);
                await this.page.click(CONFIG.FORM_FIELDS.SUBMIT_BUTTON);
                const response = await responsePromise;
                const result = await response.json();
                // Process API response like the working scraper
                if (result.state === 'success') {
                    console.log('✅ Result found successfully! Roll Number: ' + rollNumber);
                    // Also parse the HTML table for additional data
                    const tableData = await this.parseResultsTable();
                    return {
                        success: true,
                        rollNumber,
                        data: this.transformApiResponse(result.data, rollNumber, tableData),
                        timestamp: new Date().toISOString(),
                        processingTime: Date.now() - startTime
                    };
                }
                else if (result.message === 'No record found') {
                    console.log('❌ No record found for this roll number: ' + rollNumber);
                    return {
                        success: false,
                        rollNumber,
                        error: 'No record found',
                        timestamp: new Date().toISOString(),
                        processingTime: Date.now() - startTime
                    };
                }
                else {
                    console.log('[DEBUG] Invalid captcha, retrying...');
                    // Clear captcha input and refresh
                    await this.page.fill(CONFIG.FORM_FIELDS.CAPTCHA_INPUT, '');
                    await this.page.click(CONFIG.FORM_FIELDS.REFRESH_CAPTCHA);
                    await this.page.waitForTimeout(1000);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                lastError = errorMessage;
                console.error(`[DEBUG] Error on attempt ${attempt}:`, errorMessage);
                if (attempt === this.maxRetries) {
                    break;
                }
                await this.page?.waitForTimeout(2000);
            }
        }
        return {
            success: false,
            rollNumber,
            error: `Failed after ${this.maxRetries} attempts: ${lastError}`,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
    }
    /**
     * Parse results table from HTML
     */
    async parseResultsTable() {
        try {
            // Wait for the results table to appear
            await this.page?.waitForSelector('#dataContainer table', { timeout: 5000 });
            // Extract table data
            const tableData = await this.page?.evaluate(() => {
                const table = document.querySelector('#dataContainer table tbody tr');
                if (!table)
                    return null;
                const cells = table.querySelectorAll('td');
                if (cells.length < 9)
                    return null;
                return {
                    barcodeNumber: cells[0]?.textContent?.trim() || '',
                    entranceRollNumber: cells[1]?.textContent?.trim() || '',
                    applicantName: cells[2]?.textContent?.trim() || '',
                    entranceScore: cells[3]?.textContent?.trim() || '',
                    course: cells[4]?.textContent?.trim() || '',
                    stream: cells[5]?.textContent?.trim() || '',
                    socialCategory: cells[6]?.textContent?.trim() || '',
                    remarks: cells[8]?.textContent?.trim() || ''
                };
            });
            return tableData;
        }
        catch (error) {
            console.log('[DEBUG] Could not parse results table:', error.message);
            return null;
        }
    }
    transformApiResponse(apiData, rollNumber, tableData) {
        // Transform the API response data into our StudentData format
        // Combine with table data if available for more complete information
        return {
            rollNumber,
            name: tableData?.applicantName || apiData.vchApplicantName || '',
            course: tableData?.course || apiData.vchCourse || '',
            stream: tableData?.stream || apiData.vchStream || '',
            socialCategory: tableData?.socialCategory || apiData.vchSocialCategory || '',
            score: parseFloat(tableData?.entranceScore || apiData.vchPreference || '0'),
            // Additional fields from table data
            barcodeNumber: tableData?.barcodeNumber || '',
            entranceRollNumber: tableData?.entranceRollNumber || rollNumber,
            remarks: tableData?.remarks || ''
        };
    }
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
                console.log('🔄 Browser closed');
            }
        }
        catch (error) {
            console.error('Error closing browser:', error);
        }
    }
}
