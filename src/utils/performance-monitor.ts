// Performance monitoring for captcha solving
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: {
    totalCaptchasSolved: number;
    totalCaptchaTime: number;
    averageCaptchaTime: number;
    fastestCaptcha: number;
    slowestCaptcha: number;
    successRate: number;
    totalAttempts: number;
    successfulAttempts: number;
  } = {
    totalCaptchasSolved: 0,
    totalCaptchaTime: 0,
    averageCaptchaTime: 0,
    fastestCaptcha: Infinity,
    slowestCaptcha: 0,
    successRate: 0,
    totalAttempts: 0,
    successfulAttempts: 0,
  };

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordCaptchaAttempt(success: boolean, timeMs: number): void {
    this.metrics.totalAttempts++;

    if (success) {
      this.metrics.successfulAttempts++;
      this.metrics.totalCaptchasSolved++;
      this.metrics.totalCaptchaTime += timeMs;
      this.metrics.averageCaptchaTime =
        this.metrics.totalCaptchaTime / this.metrics.totalCaptchasSolved;
      this.metrics.fastestCaptcha = Math.min(
        this.metrics.fastestCaptcha,
        timeMs
      );
      this.metrics.slowestCaptcha = Math.max(
        this.metrics.slowestCaptcha,
        timeMs
      );
    }

    this.metrics.successRate =
      (this.metrics.successfulAttempts / this.metrics.totalAttempts) * 100;
  }

  getMetrics() {
    return {
      ...this.metrics,
      fastestCaptcha:
        this.metrics.fastestCaptcha === Infinity
          ? 0
          : this.metrics.fastestCaptcha,
    };
  }

  reset(): void {
    this.metrics = {
      totalCaptchasSolved: 0,
      totalCaptchaTime: 0,
      averageCaptchaTime: 0,
      fastestCaptcha: Infinity,
      slowestCaptcha: 0,
      successRate: 0,
      totalAttempts: 0,
      successfulAttempts: 0,
    };
  }

  logPerformanceReport(): void {
    const metrics = this.getMetrics();
    console.log("\n📊 Captcha Performance Report:");
    console.log(`   Total Attempts: ${metrics.totalAttempts}`);
    console.log(
      `   Successful: ${
        metrics.successfulAttempts
      } (${metrics.successRate.toFixed(1)}%)`
    );
    console.log(`   Average Time: ${metrics.averageCaptchaTime.toFixed(0)}ms`);
    console.log(`   Fastest: ${metrics.fastestCaptcha}ms`);
    console.log(`   Slowest: ${metrics.slowestCaptcha}ms`);
  }
}
