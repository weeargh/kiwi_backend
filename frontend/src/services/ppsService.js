import api from './api';
import { extractApiResponse, createEmptyPagination } from '../utils/dataUtils';
import { isApiEnabled, getMockData } from '../config/apiConfig';

/**
 * Service for managing Price Per Share (PPS) operations
 */
const ppsService = {
  /**
   * Get the current price per share for the tenant
   * @returns {Promise} Promise with PPS data
   */
  getCurrentPPS: async () => {
    try {
      // Check if PPS API is enabled
      if (!isApiEnabled('pps')) {
        console.info('PPS API is disabled, using mock data instead of real API');
        return getMockData('pps.current');
      }
      
      const response = await api.get('/pps/current');
      return extractApiResponse(response, null);
    } catch (error) {
      console.error('Error fetching current PPS:', error);
      if (error.status === 404) {
        // Return null instead of throwing error when no PPS is set
        return null;
      }
      throw error;
    }
  },

  /**
   * Get PPS history with pagination
   * @param {Object} options - Pagination and filtering options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 20)
   * @param {string} options.fromDate - Filter by effective date after this date (YYYY-MM-DD)
   * @param {string} options.toDate - Filter by effective date before this date (YYYY-MM-DD)
   * @returns {Promise} Promise with PPS history data and pagination
   */
  getPPSHistory: async ({ page = 1, limit = 20, fromDate, toDate } = {}) => {
    try {
      // Check if PPS API is enabled
      if (!isApiEnabled('pps')) {
        console.info('PPS API is disabled, using mock data instead of real API');
        return getMockData('pps.history');
      }
      
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      
      if (fromDate) {
        params.append('from_date', fromDate);
      }
      
      if (toDate) {
        params.append('to_date', toDate);
      }
      
      const response = await api.get(`/pps?${params.toString()}`);
      return extractApiResponse(response, createEmptyPagination(page, limit));
    } catch (error) {
      console.error('Error fetching PPS history:', error);
      throw error;
    }
  },

  /**
   * Create a new PPS entry
   * @param {Object} ppsData - The PPS data
   * @param {string} ppsData.effective_date - Effective date (YYYY-MM-DD)
   * @param {string} ppsData.price_per_share - Price per share (positive number)
   * @returns {Promise} Promise with the created PPS data
   */
  createPPS: async (ppsData) => {
    try {
      const response = await api.post('/pps', ppsData);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error('Error creating PPS record:', error);
      throw error;
    }
  },

  /**
   * Update an existing PPS entry
   * @param {string} ppsId - The ID of the PPS entry to update
   * @param {Object} ppsData - The PPS data to update
   * @param {string} ppsData.effective_date - New effective date (YYYY-MM-DD)
   * @param {string} ppsData.price_per_share - New price per share (positive number)
   * @returns {Promise} Promise with the updated PPS data
   */
  updatePPS: async (ppsId, ppsData) => {
    try {
      const response = await api.put(`/pps/${ppsId}`, ppsData);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error('Error updating PPS record:', error);
      throw error;
    }
  }
};

export default ppsService; 