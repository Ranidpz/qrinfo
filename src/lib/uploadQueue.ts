/**
 * Upload Queue with retry mechanism
 * Handles concurrent uploads gracefully with exponential backoff
 */

interface QueuedUpload {
  id: string;
  formData: FormData;
  endpoint: string;
  retries: number;
  maxRetries: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface BatchUploadProgress {
  completed: number;
  failed: number;
  total: number;
}

export interface BatchUploadResult {
  successful: { index: number; data: unknown }[];
  failed: { index: number; label: string; error: string }[];
}

class UploadQueue {
  private queue: QueuedUpload[] = [];
  private activeUploads = 0;
  private maxConcurrent = 3; // Max concurrent uploads
  private processing = false;

  /**
   * Add an upload to the queue
   */
  async upload(
    formData: FormData,
    endpoint: string,
    maxRetries = 3
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const upload: QueuedUpload = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        formData,
        endpoint,
        retries: 0,
        maxRetries,
        resolve,
        reject,
      };

      this.queue.push(upload);
      this.processQueue();
    });
  }

  /**
   * Upload a batch of files with progress tracking.
   * All items are queued at once (3 concurrent, auto-retry on 429).
   * Returns results for each item (success or failure).
   */
  async uploadBatch(
    items: { formData: FormData; label: string }[],
    endpoint: string,
    onProgress?: (progress: BatchUploadProgress) => void,
    maxRetries = 3
  ): Promise<BatchUploadResult> {
    let completed = 0;
    let failed = 0;
    const total = items.length;

    const promises = items.map((item, index) =>
      this.upload(item.formData, endpoint, maxRetries)
        .then((data) => {
          completed++;
          onProgress?.({ completed, failed, total });
          return { status: 'fulfilled' as const, index, data };
        })
        .catch((error: Error) => {
          failed++;
          onProgress?.({ completed, failed, total });
          return { status: 'rejected' as const, index, label: item.label, error: error.message };
        })
    );

    const results = await Promise.all(promises);

    return {
      successful: results
        .filter((r): r is { status: 'fulfilled'; index: number; data: unknown } => r.status === 'fulfilled')
        .map(({ index, data }) => ({ index, data })),
      failed: results
        .filter((r): r is { status: 'rejected'; index: number; label: string; error: string } => r.status === 'rejected')
        .map(({ index, label, error }) => ({ index, label, error })),
    };
  }

  /**
   * Process the upload queue
   */
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 && this.activeUploads < this.maxConcurrent) {
      const upload = this.queue.shift();
      if (upload) {
        this.activeUploads++;
        this.executeUpload(upload);
      }
    }

    this.processing = false;
  }

  /**
   * Execute a single upload with retry logic
   */
  private async executeUpload(upload: QueuedUpload) {
    try {
      const response = await fetch(upload.endpoint, {
        method: 'POST',
        body: upload.formData,
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await this.delay(retryAfter * 1000);
        this.retryUpload(upload);
        return;
      }

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      upload.resolve(data);
    } catch (error) {
      if (upload.retries < upload.maxRetries) {
        this.retryUpload(upload);
      } else {
        upload.reject(error instanceof Error ? error : new Error('Upload failed after max retries'));
      }
    } finally {
      this.activeUploads--;
      this.processQueue();
    }
  }

  /**
   * Retry an upload with exponential backoff
   */
  private async retryUpload(upload: QueuedUpload) {
    upload.retries++;
    const backoffMs = Math.min(1000 * Math.pow(2, upload.retries), 10000); // Max 10 seconds
    await this.delay(backoffMs);
    this.queue.unshift(upload); // Add to front of queue
    this.processQueue();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      active: this.activeUploads,
      maxConcurrent: this.maxConcurrent,
    };
  }
}

// Singleton instance
export const uploadQueue = new UploadQueue();

/**
 * Helper function to upload with queue
 */
export async function queuedUpload(
  formData: FormData,
  endpoint: string
): Promise<unknown> {
  return uploadQueue.upload(formData, endpoint);
}
