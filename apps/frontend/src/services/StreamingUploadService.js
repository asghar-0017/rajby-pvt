/**
 * Streaming Upload Service for BulInvoice
 * Provides real-time progress tracking and chunked uploads
 */

import { api } from "../API/Api";

class StreamingUploadService {
  constructor() {
    this.activeUploads = new Map();
    this.defaultChunkSize = 1000; // Large chunk size - send all at once
  }

  /**
   * Upload invoices with streaming progress
   * @param {Array} invoices - Array of invoices to upload
   * @param {Object} options - Upload options
   * @returns {Promise} Upload result with progress tracking
   */
  async uploadInvoices(invoices, options = {}) {
    const {
      tenantId,
      chunkSize = this.defaultChunkSize,
      onProgress = () => {},
      onChunkComplete = () => {},
      onError = () => {},
    } = options;

    if (!tenantId) {
      throw new Error("Tenant ID is required for upload");
    }

    const uploadId = this.generateUploadId();
    const totalInvoices = invoices.length;
    const totalChunks = Math.ceil(totalInvoices / chunkSize);

    // Initialize upload tracking
    this.activeUploads.set(uploadId, {
      totalInvoices,
      totalChunks,
      completedChunks: 0,
      completedInvoices: 0,
      errors: [],
      warnings: [],
      startTime: Date.now(),
    });

    try {
      // SIMPLIFIED: Send all invoices at once instead of chunking
      console.log(`🚀 Uploading all ${totalInvoices} invoices at once...`);

      // Update progress
      const progress = {
        uploadId,
        chunkIndex: 1,
        totalChunks: 1,
        chunkSize: totalInvoices,
        completedInvoices: 0,
        totalInvoices,
        percentage: 0,
        status: "uploading",
      };

      onProgress(progress);

      // Upload all invoices at once
      const result = await this.uploadChunk(tenantId, invoices, {
        chunkSize: totalInvoices,
        chunkIndex: 0,
      });

      // Update tracking
      const upload = this.activeUploads.get(uploadId);
      upload.completedChunks = 1;
      upload.completedInvoices = totalInvoices;
      upload.errors.push(...(result.errors || []));
      upload.warnings.push(...(result.warnings || []));

      // Notify completion
      onChunkComplete({
        uploadId,
        chunkIndex: 1,
        chunkResult: result,
        totalProcessed: totalInvoices,
        totalInvoices,
      });

      // Calculate final results
      const totalTime = Date.now() - upload.startTime;
      const successfulInvoices = result.created?.length || 0;

      const finalResult = {
        uploadId,
        success: true,
        totalInvoices,
        successfulInvoices,
        failedInvoices: totalInvoices - successfulInvoices,
        totalChunks: 1,
        completedChunks: 1,
        errors: upload.errors,
        warnings: upload.warnings,
        totalTime,
        performance: {
          invoicesPerSecond: Math.round(
            (successfulInvoices / totalTime) * 1000
          ),
          averageTimePerInvoice: Math.round(totalTime / totalInvoices),
        },
        results: [result],
      };

      // Final progress update
      onProgress({
        uploadId,
        chunkIndex: 1,
        totalChunks: 1,
        completedInvoices: successfulInvoices,
        totalInvoices,
        percentage: 100,
        status: "completed",
        result: finalResult,
      });

      return finalResult;
    } catch (error) {
      console.error("Upload failed:", error);

      onError({
        uploadId,
        error: error.message,
      });

      throw error;
    } finally {
      // Clean up upload tracking
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Upload a single chunk of invoices
   * @param {string} tenantId - Tenant ID
   * @param {Array} chunk - Chunk of invoices
   * @param {Object} options - Chunk options
   */
  async uploadChunk(tenantId, chunk, options = {}) {
    const { chunkSize, chunkIndex } = options;

    try {
      // Debug: Log the payload being sent
      console.log("🔍 API Payload Debug:", {
        tenantId,
        chunkSize,
        chunkIndex,
        totalInvoices: chunk.length,
        firstInvoice: chunk[0],
        firstInvoiceItems: chunk[0]?.items?.[0],
        dcDocFields: chunk[0]?.items?.[0]
          ? {
              dcDocId: chunk[0].items[0].dcDocId,
              dcDocDate: chunk[0].items[0].dcDocDate,
              item_dcDocId: chunk[0].items[0].item_dcDocId,
              item_dcDocDate: chunk[0].items[0].item_dcDocDate,
              allDcDocFields: Object.keys(chunk[0].items[0]).filter((key) =>
                key.includes("dcDoc")
              ),
            }
          : null,
      });

      const response = await api.post(`/tenant/${tenantId}/invoices/bulk`, {
        invoices: chunk,
        chunkSize,
        chunkIndex,
      });

      const result = response.data;

      if (!result.success) {
        throw new Error(result.message || "Upload failed");
      }

      return result.data;
    } catch (error) {
      console.error("Chunk upload error:", error);
      throw error;
    }
  }

  /**
   * Cancel an active upload
   * @param {string} uploadId - Upload ID to cancel
   */
  cancelUpload(uploadId) {
    if (this.activeUploads.has(uploadId)) {
      this.activeUploads.delete(uploadId);
      return true;
    }
    return false;
  }

  /**
   * Get upload status
   * @param {string} uploadId - Upload ID
   */
  getUploadStatus(uploadId) {
    return this.activeUploads.get(uploadId) || null;
  }

  /**
   * Get all active uploads
   */
  getActiveUploads() {
    return Array.from(this.activeUploads.entries()).map(([id, data]) => ({
      uploadId: id,
      ...data,
    }));
  }

  /**
   * Generate unique upload ID
   */
  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Estimate upload time based on historical data
   * @param {number} invoiceCount - Number of invoices
   * @param {number} chunkSize - Chunk size
   */
  estimateUploadTime(invoiceCount, chunkSize = this.defaultChunkSize) {
    // Based on historical performance data
    const averageTimePerInvoice = 50; // milliseconds
    const averageTimePerChunk = 2000; // milliseconds

    const totalChunks = Math.ceil(invoiceCount / chunkSize);
    const estimatedTime =
      invoiceCount * averageTimePerInvoice + totalChunks * averageTimePerChunk;

    return {
      estimatedTimeMs: estimatedTime,
      estimatedTimeSeconds: Math.round(estimatedTime / 1000),
      estimatedTimeMinutes: Math.round(estimatedTime / 60000),
      totalChunks,
    };
  }
}

export default new StreamingUploadService();
