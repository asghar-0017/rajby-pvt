import { useState, useCallback, useRef } from 'react';
import StreamingUploadService from '../services/StreamingUploadService';

/**
 * Custom hook for streaming uploads with real-time progress tracking
 */
export const useStreamingUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    percentage: 0,
    completedInvoices: 0,
    totalInvoices: 0,
    currentChunk: 0,
    totalChunks: 0,
    status: 'idle', // idle, uploading, completed, error
    message: '',
    errors: [],
    warnings: [],
    performance: null,
  });
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const uploadIdRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Start streaming upload
   * @param {Array} invoices - Invoices to upload
   * @param {Object} options - Upload options
   */
  const startUpload = useCallback(async (invoices, options = {}) => {
    if (isUploading) {
      throw new Error('Upload already in progress');
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setUploadProgress({
      percentage: 0,
      completedInvoices: 0,
      totalInvoices: invoices.length,
      currentChunk: 0,
      totalChunks: 0,
      status: 'uploading',
      message: 'Initializing upload...',
      errors: [],
      warnings: [],
      performance: null,
    });

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const result = await StreamingUploadService.uploadInvoices(invoices, {
        ...options,
        onProgress: (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            percentage: progress.percentage,
            completedInvoices: progress.completedInvoices,
            totalInvoices: progress.totalInvoices,
            currentChunk: progress.chunkIndex,
            totalChunks: progress.totalChunks,
            status: progress.status,
            message: progress.status === 'completed' 
              ? 'Upload completed successfully!' 
              : `Uploading chunk ${progress.chunkIndex} of ${progress.totalChunks}...`,
          }));
        },
        onChunkComplete: (chunkData) => {
          setUploadProgress(prev => ({
            ...prev,
            message: `Completed chunk ${chunkData.chunkIndex} of ${chunkData.totalChunks}`,
          }));
        },
        onError: (error) => {
          setUploadProgress(prev => ({
            ...prev,
            errors: [...prev.errors, error],
            message: `Error in chunk ${error.chunkIndex}: ${error.error}`,
          }));
        },
      });

      setUploadResult(result);
      setUploadProgress(prev => ({
        ...prev,
        status: 'completed',
        percentage: 100,
        message: 'Upload completed successfully!',
        errors: result.errors,
        warnings: result.warnings,
        performance: result.performance,
      }));

      return result;
    } catch (error) {
      setUploadError(error);
      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        message: `Upload failed: ${error.message}`,
      }));
      throw error;
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [isUploading]);

  /**
   * Cancel current upload
   */
  const cancelUpload = useCallback(() => {
    if (uploadIdRef.current) {
      StreamingUploadService.cancelUpload(uploadIdRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsUploading(false);
    setUploadProgress(prev => ({
      ...prev,
      status: 'cancelled',
      message: 'Upload cancelled',
    }));
  }, []);

  /**
   * Reset upload state
   */
  const resetUpload = useCallback(() => {
    setIsUploading(false);
    setUploadProgress({
      percentage: 0,
      completedInvoices: 0,
      totalInvoices: 0,
      currentChunk: 0,
      totalChunks: 0,
      status: 'idle',
      message: '',
      errors: [],
      warnings: [],
      performance: null,
    });
    setUploadResult(null);
    setUploadError(null);
    uploadIdRef.current = null;
  }, []);

  /**
   * Estimate upload time
   * @param {number} invoiceCount - Number of invoices
   * @param {number} chunkSize - Chunk size
   */
  const estimateUploadTime = useCallback((invoiceCount, chunkSize = 500) => {
    return StreamingUploadService.estimateUploadTime(invoiceCount, chunkSize);
  }, []);

  /**
   * Get upload statistics
   */
  const getUploadStats = useCallback(() => {
    if (!uploadResult) return null;

    return {
      totalInvoices: uploadResult.totalInvoices,
      successfulInvoices: uploadResult.successfulInvoices,
      failedInvoices: uploadResult.failedInvoices,
      successRate: Math.round((uploadResult.successfulInvoices / uploadResult.totalInvoices) * 100),
      totalTime: uploadResult.totalTime,
      performance: uploadResult.performance,
      errors: uploadResult.errors,
      warnings: uploadResult.warnings,
    };
  }, [uploadResult]);

  return {
    // State
    isUploading,
    uploadProgress,
    uploadResult,
    uploadError,
    
    // Actions
    startUpload,
    cancelUpload,
    resetUpload,
    
    // Utilities
    estimateUploadTime,
    getUploadStats,
  };
};
