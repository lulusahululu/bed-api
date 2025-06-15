<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# BEd Results Scraper API - Copilot Instructions

This is a Node.js API server built with Hono framework for scraping BEd results from SAMS Odisha portal.

## Project Context
- **Framework**: Hono (lightweight, fast web framework)
- **Runtime**: Node.js with TypeScript
- **Purpose**: Multi-processing API server for scraping student results
- **Architecture**: RESTful API with clustering support

## Key Technologies
- **Hono**: Web framework for building APIs
- **Playwright**: Browser automation for scraping
- **Tesseract.js**: OCR for captcha solving
- **Cluster**: Node.js clustering for multi-processing
- **TypeScript**: Type-safe development

## Code Patterns
- Use async/await for all asynchronous operations
- Implement proper error handling with try-catch blocks
- Use TypeScript interfaces for data structures
- Follow RESTful API conventions
- Implement request validation and sanitization
- Use clustering for scalability

## API Design
- Accept roll numbers as input
- Return structured student data
- Include proper HTTP status codes
- Implement rate limiting
- Add request/response logging
- Support batch processing

## Scraping Requirements
- Handle captcha solving with OCR
- Implement retry logic for failed requests
- Use proper delays between requests
- Support headless browser operation
- Handle network timeouts gracefully
