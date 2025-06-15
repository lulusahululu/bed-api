// Configuration for BEd Results Scraper API
export const CONFIG = {
    // Portal settings
    PORTAL_URL: 'https://resultsbed.samsodisha.gov.in/ResultBED/BEDSelectionlist',
    MAX_RETRIES: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    DELAY_BETWEEN_REQUESTS: 2000, // 2 seconds
    TIMEOUT: parseInt(process.env.SCRAPING_TIMEOUT_MS || '30000'),
    // Browser settings
    BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT_MS || '30000'),
    HEADLESS: process.env.HEADLESS_MODE !== 'false',
    // Worker settings
    MAX_WORKERS: parseInt(process.env.MAX_WORKERS || '4'),
    // Form field IDs (from working scraper)
    FORM_FIELDS: {
        ROLL_NUMBER: '#txtBarcode',
        CAPTCHA_INPUT: '#captchaInput',
        CAPTCHA_IMAGE: '#imgcode',
        SUBMIT_BUTTON: '#btnSubmit',
        REFRESH_CAPTCHA: '#switchCode'
    },
    // API endpoint for result submission
    RESULT_API_ENDPOINT: '/ResultBED/appstatusbed',
    // OCR settings
    OCR_CONFIGS: [
        { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' },
        { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', tessedit_pageseg_mode: '8' },
        { tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', tessedit_pageseg_mode: '7' }
    ],
    // Validation
    ROLL_NUMBER_PATTERN: /^ED\d{2}A\d{5}$/
};
