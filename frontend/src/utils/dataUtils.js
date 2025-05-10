/**
 * Utility functions for handling data, formatting, and error handling
 */

/**
 * Formats a decimal number as a string with 3 decimal places
 * Follows the SPECIFICATION.md requirement for DECIMAL(12,3)
 * 
 * @param {number|string} value - The decimal value to format
 * @returns {string} - Formatted string with 3 decimal places
 */
export const formatDecimal = (value) => {
  if (value === null || value === undefined) return '0.000';
  
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Format with 3 decimal places
  return numValue.toFixed(3);
};

/**
 * Formats a decimal value for display with thousands separators and 3 decimal places
 * 
 * @param {number|string} value - The decimal value to format
 * @returns {string} - Formatted string with thousands separators and 3 decimal places
 */
export const formatDisplayDecimal = (value) => {
  if (value === null || value === undefined) return '0.000';
  
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Format with locale-specific thousands separators and 3 decimal places
  return numValue.toLocaleString(undefined, { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 3 
  });
};

/**
 * Formats a price value as currency with the $ symbol
 * 
 * @param {number|string} value - The price value to format
 * @returns {string} - Formatted price string with $ symbol
 */
export const formatPrice = (value) => {
  if (value === null || value === undefined) return '$0.000';
  
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Format with $ symbol and 3 decimal places
  return `$${numValue.toLocaleString(undefined, { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 3 
  })}`;
};

/**
 * Safely handles API responses with proper error checking
 * Handles the API envelope format: {"success":true,"data":{}}
 * 
 * @param {Object} response - The API response to process
 * @param {Object} fallback - Fallback value to return if response is invalid
 * @returns {Object} - The data from the response or the fallback value
 */
export const extractApiResponse = (response, fallback = null) => {
  try {
    // Handle case where response is null or undefined
    if (!response) {
      console.warn('Received empty API response');
      return fallback;
    }
    
    // Handle case where response.data exists - the standard Axios response
    if (response.data) {
      // Check if the response follows the API envelope format
      if (response.data.success === true && response.data.data !== undefined) {
        // This is the envelope format from the API spec: {"success":true,"data":{}}
        return response.data.data;
      }
      
      // If no envelope but has data, return that directly
      return response.data;
    }
    
    // If response is already the data object itself (e.g., from mock data)
    return response;
  } catch (error) {
    console.error('Error extracting API response:', error);
    return fallback;
  }
};

/**
 * Creates an empty pagination structure for initializing data
 * 
 * @param {number} itemsPerPage - Number of items per page
 * @returns {Object} - Empty pagination structure
 */
export const createEmptyPagination = (itemsPerPage = 10) => {
  return {
    items: [],
    pagination: {
      total_items: 0,
      total_pages: 0,
      current_page: 1,
      limit: itemsPerPage,
      next_page: null,
      prev_page: null
    }
  };
};

/**
 * Format a date as a standardized ISO string (YYYY-MM-DD)
 * 
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export const formatISODate = (date) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
};

/**
 * Validates if a value is a valid decimal number with up to 3 decimal places
 * 
 * @param {string|number} value - Value to validate
 * @returns {boolean} - True if value is valid, false otherwise
 */
export const isValidDecimal = (value) => {
  if (value === null || value === undefined || value === '') return false;
  
  // Convert to string if it's a number
  const strValue = typeof value === 'number' ? value.toString() : value;
  
  // Regex pattern for decimal with up to 3 decimal places
  // Allows: 
  // - Optional negative sign
  // - Digits before decimal
  // - Optional decimal point followed by up to 3 digits
  const pattern = /^-?\d+(\.\d{1,3})?$/;
  
  return pattern.test(strValue);
}; 