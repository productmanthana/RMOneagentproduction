/**
 * Request Queue with Concurrency Limiting
 * 
 * Prevents OpenAI rate limits by:
 * 1. Limiting concurrent requests
 * 2. Queuing excess requests
 * 3. Processing queue in order with delays
 */

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  addedAt: number;
}

export class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeCount: number = 0;
  private maxConcurrent: number;
  private delayBetweenRequests: number;
  private lastRequestTime: number = 0;

  constructor(maxConcurrent: number = 3, delayBetweenRequests: number = 200) {
    this.maxConcurrent = maxConcurrent;
    this.delayBetweenRequests = delayBetweenRequests;
  }

  /**
   * Add a request to the queue
   * Returns a promise that resolves when the request completes
   */
  async enqueue<T>(execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      // Log queue status periodically
      if (this.queue.length > 2) {
        console.log(`[RequestQueue] Queue size: ${this.queue.length}, Active: ${this.activeCount}/${this.maxConcurrent}`);
      }
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    // Check if we can process more requests
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Enforce delay between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.delayBetweenRequests) {
      const waitTime = this.delayBetweenRequests - timeSinceLastRequest;
      setTimeout(() => this.processQueue(), waitTime);
      return;
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) return;

    this.activeCount++;
    this.lastRequestTime = Date.now();

    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeCount--;
      // Process next request
      this.processQueue();
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): { queueLength: number; activeCount: number; maxConcurrent: number } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * Check if the queue is busy (has pending requests)
   */
  isBusy(): boolean {
    return this.queue.length > 0 || this.activeCount >= this.maxConcurrent;
  }

  /**
   * Get estimated wait time in seconds
   */
  getEstimatedWaitTime(): number {
    const pendingRequests = this.queue.length + this.activeCount;
    const avgRequestTime = 3; // Average 3 seconds per OpenAI request
    return Math.ceil((pendingRequests / this.maxConcurrent) * avgRequestTime);
  }
}

// Singleton instance for OpenAI requests
export const openaiQueue = new RequestQueue(3, 300); // 3 concurrent, 300ms between
