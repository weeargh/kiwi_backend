import api from './api';
import { extractApiResponse, createEmptyPagination } from '../utils/dataUtils';
import { isApiEnabled, getMockData } from '../config/apiConfig';

/**
 * Service for managing equity pool operations
 */
const poolService = {
  /**
   * Get the current equity pool for the tenant
   * @returns {Promise} Promise with pool data
   */
  getPool: async () => {
    try {
      const response = await api.get('/pools');
      console.log('Pool response:', response); // Should always be strict contract
      
      // Strict backend contract: always { success: true, data: {...} } or { success: false, error: {...} }
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        };
      }
      // If error, pass it along
      return {
        success: false,
        error: response.error || { code: 'NO_DATA', message: 'No pool data available' }
      };
    } catch (error) {
      console.error('Error fetching pool data:', error);
      throw error;
    }
  },

  /**
   * Get events for a specific pool with pagination
   * @param {string} poolId - The ID of the pool
   * @param {Object} options - Pagination and filtering options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 20)
   * @param {string} options.fromDate - Filter by events after this date (YYYY-MM-DD)
   * @param {string} options.toDate - Filter by events before this date (YYYY-MM-DD)
   * @returns {Promise} Promise with events data and pagination
   */
  getPoolEvents: async (poolId, { page = 1, limit = 20, fromDate, toDate } = {}) => {
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      
      if (fromDate) {
        params.append('from_date', fromDate);
      }
      
      if (toDate) {
        params.append('to_date', toDate);
      }
      
      const response = await api.get(`/pools/${poolId}/events?${params.toString()}`);
      return extractApiResponse(response, createEmptyPagination(page, limit));
    } catch (error) {
      console.error('Error fetching pool events:', error);
      throw error;
    }
  },

  /**
   * Create a new pool event (top-up or reduction)
   * @param {string} poolId - The ID of the pool
   * @param {Object} eventData - The event data
   * @param {string} eventData.amount - Amount of shares (signed number: positive for top_up, negative for reduction)
   * @param {string} eventData.event_type - Type of event ('top_up' or 'reduction')
   * @param {string} eventData.effective_date - Effective date (YYYY-MM-DD)
   * @param {string} eventData.notes - Optional notes
   * @returns {Promise} Promise with the created event data
   */
  createPoolEvent: async (poolId, eventData) => {
    try {
      // Validate the data as per specification
      if (!eventData.amount || !eventData.event_type || !eventData.effective_date) {
        throw new Error('Missing required fields for pool event');
      }
      
      // Validate event_type
      if (!['top_up', 'reduction'].includes(eventData.event_type)) {
        throw new Error('Invalid event type. Must be "top_up" or "reduction"');
      }
      
      // Ensure amount sign matches event_type
      const amount = parseFloat(eventData.amount);
      if ((eventData.event_type === 'top_up' && amount <= 0) || 
          (eventData.event_type === 'reduction' && amount >= 0)) {
        throw new Error('Amount sign must match event type (positive for top_up, negative for reduction)');
      }
      
      const response = await api.post(`/pools/${poolId}/events`, eventData);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error('Error creating pool event:', error);
      // Re-throw with more details to help the UI provide specific feedback
      throw error;
    }
  }
};

export default poolService; 