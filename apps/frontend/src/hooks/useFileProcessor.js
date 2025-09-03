import { useState, useRef, useCallback } from 'react';

/**
 * Custom hook for processing large files using Web Workers
 * Prevents UI blocking during file processing
 */
export const useFileProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState(null);
  
  const workerRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Initialize Web Worker
   */
  const initializeWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    try {
      // Create Web Worker
      const worker = new Worker(
        new URL('../workers/fileProcessor.worker.js', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e) => {
        const { type, data, error, percentage, message } = e.data;

        switch (type) {
          case 'progress':
            setProgress(percentage);
            setProgressMessage(message);
            break;

          case 'result':
            setIsProcessing(false);
            setProgress(100);
            setProgressMessage('Processing complete!');
            break;

          case 'error':
            setIsProcessing(false);
            setError(error);
            setProgress(0);
            setProgressMessage('');
            break;

          case 'cancelled':
            setIsProcessing(false);
            setProgress(0);
            setProgressMessage('');
            break;
        }
      };

      worker.onerror = (error) => {
        console.error('Web Worker error:', error);
        setIsProcessing(false);
        setError('Worker processing failed');
        setProgress(0);
        setProgressMessage('');
      };

      workerRef.current = worker;
      return worker;
    } catch (error) {
      console.error('Failed to create Web Worker:', error);
      setError('Failed to initialize file processor');
      return null;
    }
  }, []);

  /**
   * Process file using Web Worker
   * @param {File} file - File to process
   * @param {Array} expectedColumns - Expected column headers
   * @returns {Promise} Processing result
   */
  const processFile = useCallback(async (file, expectedColumns) => {
    if (isProcessing) {
      throw new Error('Already processing a file');
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage('Initializing...');
    setError(null);

    const worker = initializeWorker();
    if (!worker) {
      setIsProcessing(false);
      throw new Error('Failed to initialize worker');
    }

    return new Promise((resolve, reject) => {
      // Set up abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Handle worker response
      const handleWorkerMessage = (e) => {
        const { type, data, error } = e.data;

        if (type === 'result') {
          worker.removeEventListener('message', handleWorkerMessage);
          resolve(data);
        } else if (type === 'error') {
          worker.removeEventListener('message', handleWorkerMessage);
          reject(new Error(error));
        }
      };

      worker.addEventListener('message', handleWorkerMessage);

             // Read file and send to worker
       const reader = new FileReader();
       
       reader.onload = async (e) => {
         try {
           const fileType = file.type === 'text/csv' ? 'csv' : 'excel';
           let data;

           if (fileType === 'csv') {
             data = {
               type: fileType,
               expectedColumns,
               content: e.target.result,
             };
           } else {
             // For Excel files, parse in main thread and send to worker
             const XLSX = await import('xlsx');
             const workbook = XLSX.read(e.target.result, { type: 'array' });
             const sheetName = workbook.SheetNames[0];
             const worksheet = workbook.Sheets[sheetName];
             const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
             
             data = {
               type: fileType,
               expectedColumns,
               jsonData: jsonData,
             };
           }

           worker.postMessage({
             type: 'process',
             data,
           });
         } catch (error) {
           worker.removeEventListener('message', handleWorkerMessage);
           reject(error);
         }
       };

       reader.onerror = () => {
         worker.removeEventListener('message', handleWorkerMessage);
         reject(new Error('Failed to read file'));
       };

       // Read file based on type
       if (file.type === 'text/csv') {
         reader.readAsText(file);
       } else {
         reader.readAsArrayBuffer(file);
       }
    });
  }, [isProcessing, initializeWorker]);

  /**
   * Cancel current processing
   */
  const cancelProcessing = useCallback(() => {
    if (workerRef.current && isProcessing) {
      workerRef.current.postMessage({ type: 'cancel' });
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
    }
  }, [isProcessing]);

  /**
   * Clean up worker
   */
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsProcessing(false);
    setProgress(0);
    setProgressMessage('');
    setError(null);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setProgress(0);
    setProgressMessage('');
    setError(null);
  }, []);

  return {
    isProcessing,
    progress,
    progressMessage,
    error,
    processFile,
    cancelProcessing,
    cleanup,
    reset,
  };
};
