import api from './api';
import { extractApiResponse, createEmptyPagination } from '../utils/dataUtils';
import { isApiEnabled, getMockData } from '../config/apiConfig';

/**
 * Service for managing equity grants operations
 */
const grantsService = {
  /**
   * Get grants list with pagination
   * @param {Object} options - Pagination and filtering options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10)
   * @param {string} options.status - Filter by status
   * @returns {Promise} Promise with grants data and pagination
   */
  getGrants: async ({ page = 1, limit = 10, status } = {}) => {
    try {
      // Check if Grants API is enabled
      if (!isApiEnabled('grants')) {
        console.info('Grants API is disabled, using mock data');
        return getMockData('grants.list');
      }
      
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', limit);
      
      if (status) {
        params.append('status', status);
      }
      
      const response = await api.get(`/grants?${params.toString()}`);
      return extractApiResponse(response, createEmptyPagination(page, limit));
    } catch (error) {
      console.error('Error fetching grants:', error);
      throw error;
    }
  },

  /**
   * Get grant details by ID
   * @param {string} grantId - Grant ID
   * @returns {Promise} Promise with grant details
   */
  getGrantDetails: async (grantId) => {
    try {
      // Check if Grants API is enabled
      if (!isApiEnabled('grants')) {
        console.info('Grants API is disabled, using mock data');
        return getMockData('grants.details');
      }
      
      const response = await api.get(`/grants/${grantId}`);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error(`Error fetching grant ${grantId}:`, error);
      throw error;
    }
  },

  /**
   * Get grant summary (total shares, vested, etc.)
   * @returns {Promise} Promise with grant summary data
   */
  getGrantsSummary: async () => {
    try {
      // Check if Grants API is enabled
      if (!isApiEnabled('grants')) {
        console.info('Grants API is disabled, using mock data');
        return getMockData('grants.summary');
      }
      
      const response = await api.get('/grants/summary');
      return extractApiResponse(response, null);
    } catch (error) {
      console.error('Error fetching grants summary:', error);
      if (error.status === 404) {
        console.info('Grants summary endpoint may not be implemented yet');
        // Return a default empty summary
        return {
          total_shares: 0,
          vested_shares: 0,
          unvested_shares: 0
        };
      }
      throw error;
    }
  },

  /**
   * Create a new grant (admin only)
   * @param {Object} grantData - Data for the new grant
   * @returns {Promise} Promise with the created grant data
   */
  createGrant: async (grantData) => {
    try {
      const response = await api.post('/grants', grantData);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error('Error creating grant:', error);
      throw error;
    }
  },

  /**
   * Update a grant (admin only)
   * @param {string} grantId - The ID of the grant to update
   * @param {Object} grantData - Updated grant data
   * @returns {Promise} Promise with the updated grant data
   */
  updateGrant: async (grantId, grantData) => {
    try {
      const response = await api.patch(`/grants/${grantId}`, grantData);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error(`Error updating grant ID ${grantId}:`, error);
      throw error;
    }
  },

  /**
   * Terminate a grant (admin only)
   * @param {string} grantId - The ID of the grant to terminate
   * @param {Object} terminationData - Data for termination (termination_date, termination_reason)
   * @returns {Promise} Promise with the terminated grant data
   */
  terminateGrant: async (grantId, terminationData) => {
    try {
      const response = await api.post(`/grants/${grantId}/terminate`, terminationData);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error(`Error terminating grant ID ${grantId}:`, error);
      throw error;
    }
  },

  /**
   * Calculate vesting for a grant
   * @param {string} grantId - The ID of the grant to calculate vesting for
   * @returns {Promise} Promise with the calculation results
   */
  calculateVesting: async (grantId) => {
    try {
      const response = await api.post(`/grants/${grantId}/calculate-vesting`);
      return extractApiResponse(response, null);
    } catch (error) {
      console.error(`Error calculating vesting for grant ID ${grantId}:`, error);
      throw error;
    }
  },

  /**
   * Get vesting events for a grant
   * @param {string} grantId - The ID of the grant to get vesting events for
   * @returns {Promise} Promise with the vesting events data
   */
  getVestingEvents: async (grantId) => {
    try {
      // Check if Vesting API is enabled
      if (!isApiEnabled('vesting')) {
        console.info('Vesting API is disabled, using mock data');
        return getMockData('grants.details.vesting_events');
      }

      const response = await api.get(`/grants/${grantId}/vesting-events`);
      return extractApiResponse(response, []);
    } catch (error) {
      console.error(`Error fetching vesting events for grant ID ${grantId}:`, error);
      throw error;
    }
  }
};

export default grantsService; 