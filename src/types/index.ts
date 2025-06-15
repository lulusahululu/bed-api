// TypeScript interfaces for the BEd Results Scraper API

export interface ScrapingOptions {
  headless?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface ScrapingResult {
  success: boolean;
  rollNumber: string;
  data?: StudentData;
  error?: string;
  message?: string;
  timestamp: string;
  processingTime: number;
}

export interface StudentData {
  rollNumber: string;
  name: string;
  course: string;
  stream: string;
  socialCategory: string;
  score: number;
  // Additional fields from HTML table
  barcodeNumber?: string;
  entranceRollNumber?: string;
  remarks?: string;
}

export interface BatchScrapingRequest {
  rollNumbers: string[];
  options?: ScrapingOptions;
}

export interface BatchScrapingResponse {
  success: boolean;
  total: number;
  completed: number;
  results: ScrapingResult[];
  errors: string[];
  processingTime: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface WorkerData {
  rollNumbers: string[];
  workerId: number;
  options: ScrapingOptions;
}

export interface WorkerResult {
  workerId: number;
  results: ScrapingResult[];
  processingTime: number;
}
