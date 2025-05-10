import api from './api';
import { extractApiResponse } from '../utils/dataUtils';
import { isApiEnabled, getMockData } from '../config/apiConfig';

/**
 * Service for dashboard-related operations
 */
const dashboardService = {
  /**
   * Get recent activity for the dashboard
   * @param {number} limit - Number of items to return (default: 5)
   * @returns {Promise} Promise with recent activity data
   */
  getRecentActivity: async (limit = 5) => {
    try {
      // Always check mock data setting first
      if (!isApiEnabled('auditLogs')) {
        console.info('Audit logs API is disabled, using mock data');
        return getMockData('activity.items') || [];
      }

      // Only try API if mock data is not being used
      try {
        const params = new URLSearchParams();
        params.append('limit', limit);
        params.append('page', 1);
        
        const response = await api.get(`/audit-logs?${params.toString()}`);
        const auditLogs = extractApiResponse(response, { items: [] });
        
        console.log('Audit logs response:', auditLogs);
        
        if (auditLogs && auditLogs.items && Array.isArray(auditLogs.items)) {
          return auditLogs.items.map(log => {
            const type = mapActionTypeToActivityType(log.action_type);
            const amount = extractAmountFromAuditLog(log);
            
            return {
              id: log.log_id,
              date: log.created_at,
              type,
              description: getDescriptionFromAuditLog(log),
              amount
            };
          });
        } else {
          console.warn('Unexpected audit logs format, falling back to mock data');
          return getMockData('activity.items') || [];
        }
      } catch (apiError) {
        console.info('Error fetching from API, falling back to mock data');
        return getMockData('activity.items') || [];
      }
    } catch (error) {
      console.error('Error in dashboard service:', error);
      // Return at least some mock activity as fallback
      return [
        {
          id: 'mock-activity-1',
          date: new Date().toISOString(),
          type: 'grant',
          description: 'Grant created',
          amount: 100.000
        },
        {
          id: 'mock-activity-2',
          date: new Date().toISOString(),
          type: 'pool',
          description: 'Pool topped up',
          amount: 1000.000
        }
      ];
    }
  }
};

// Helper functions for audit log transformation
function mapActionTypeToActivityType(actionType) {
  const actionMap = {
    'GRANT_CREATE': 'grant',
    'GRANT_TERMINATE': 'termination',
    'VESTING_CALCULATE': 'vesting',
    'GRANT_UPDATE': 'amendment',
    'POOL_EVENT_CREATE': 'pool'
  };
  return actionMap[actionType] || 'other';
}

function getDescriptionFromAuditLog(log) {
  switch (log.action_type) {
    case 'GRANT_CREATE':
      return 'Grant created';
    case 'GRANT_TERMINATE':
      return 'Grant terminated';
    case 'VESTING_CALCULATE':
      return 'Shares vested';
    case 'GRANT_UPDATE':
      return 'Grant updated';
    case 'POOL_EVENT_CREATE':
      return log.details?.after?.event_type === 'top_up' 
        ? 'Pool topped up'
        : 'Pool reduced';
    default:
      return log.action_type.replace(/_/g, ' ').toLowerCase();
  }
}

function extractAmountFromAuditLog(log) {
  if (!log.details) return 0;
  
  switch (log.action_type) {
    case 'GRANT_CREATE':
      return log.details.after?.share_amount || 0;
    case 'GRANT_TERMINATE':
      return log.details.after?.unvested_shares_returned || 0;
    case 'VESTING_CALCULATE':
      return log.details.after?.shares_vested || 0;
    case 'POOL_EVENT_CREATE':
      return log.details.after?.amount || 0;
    default:
      return 0;
  }
}

export default dashboardService; 