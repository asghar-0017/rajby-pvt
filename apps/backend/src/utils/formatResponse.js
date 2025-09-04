/**
 * Format API response in a consistent structure
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status code
 * @param {string} error - Error details (optional)
 * @returns {object} Formatted response object
 */
export const formatResponse = (
  success,
  message,
  data = null,
  statusCode = 200,
  error = null
) => {
  const response = {
    success,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  if (data !== null) {
    response.data = data;
  }

  if (error) {
    response.error = error;
  }

  return response;
};

export default formatResponse;
