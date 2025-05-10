/**
 * API Configuration
 * 
 * This file controls which API endpoints are enabled.
 * In development mode, you can selectively disable endpoints that aren't implemented yet.
 */

// Force mock data mode to true to bypass backend API issues during development
const USE_MOCK_DATA = false;

// Control which endpoints are enabled (only applied when USE_MOCK_DATA is true)
export const API_CONFIG = {
  // Authentication endpoints (Auth0)
  auth: true,
  
  // Tenant endpoints
  tenant: true,
  
  // User endpoints
  users: true,
  
  // Employee endpoints
  employees: true,
  
  // Pool endpoints
  pools: true,
  
  // PPS endpoints
  pps: true,
  
  // Grant endpoints
  grants: true,
  
  // Vesting endpoints
  vesting: true,
  
  // Audit logs
  auditLogs: true
};

// Mock data for various API endpoints
export const MOCK_DATA = {
  // PPS mock data
  pps: {
    current: {
      pps_id: 'mock-pps-1',
      effective_date: new Date().toISOString().split('T')[0],
      price_per_share: 1.000,
      created_at: new Date().toISOString()
    },
    history: {
      items: [
        {
          pps_id: 'mock-pps-1',
          effective_date: new Date().toISOString().split('T')[0],
          price_per_share: 1.000,
          created_at: new Date().toISOString()
        }
      ],
      pagination: {
        total_items: 1,
        total_pages: 1,
        current_page: 1
      }
    }
  },
  
  // Pool mock data
  pools: {
    pool_id: 'mock-pool-1',
    initial_amount: 1000.000,
    total_pool: 1000.000,
    granted_shares: 200.000,
    returned_shares: 0.000,
    available_shares: 800.000,
    created_at: new Date().toISOString()
  },
  
  // Grant mock data
  grants: {
    summary: {
      total_shares: 200.000,
      vested_shares: 50.000,
      unvested_shares: 150.000
    },
    list: {
      items: [
        {
          grant_id: 'mock-grant-1',
          grant_date: new Date().toISOString().split('T')[0],
          share_amount: 100.000,
          vested_amount: 25.000,
          status: 'active',
          employee_id: 'mock-employee-1',
          tenant_id: 'mock-tenant-1',
          version: 0,
          created_at: new Date().toISOString()
        },
        {
          grant_id: 'mock-grant-2',
          grant_date: new Date().toISOString().split('T')[0],
          share_amount: 100.000,
          vested_amount: 25.000,
          status: 'active',
          employee_id: 'mock-employee-2',
          tenant_id: 'mock-tenant-1',
          version: 0,
          created_at: new Date().toISOString()
        }
      ],
      pagination: {
        total_items: 2,
        total_pages: 1,
        current_page: 1,
        limit: 10
      }
    },
    details: {
      grant_id: 'mock-grant-1',
      tenant_id: 'mock-tenant-1',
      employee_id: 'mock-employee-1',
      grant_date: new Date().toISOString().split('T')[0],
      share_amount: 100.000,
      vested_amount: 25.000,
      status: 'active',
      version: 0,
      created_by: 'mock-user-1',
      created_at: new Date().toISOString()
    }
  },
  
  // Vesting mock data for grant/{id}/vesting-events endpoint
  vesting: {
    next: {
      vesting_id: 'mock-vesting-1',
      grant_id: 'mock-grant-1',
      tenant_id: 'mock-tenant-1',
      vest_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      shares_vested: 2.083,
      pps_snapshot: 1.000,
      created_by: 'mock-user-1',
      created_at: new Date().toISOString()
    },
    events: [
      {
        vesting_id: 'mock-vesting-1',
        grant_id: 'mock-grant-1',
        tenant_id: 'mock-tenant-1',
        vest_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        shares_vested: 2.083,
        pps_snapshot: 1.000,
        created_by: 'mock-user-1',
        created_at: new Date().toISOString()
      },
      {
        vesting_id: 'mock-vesting-2',
        grant_id: 'mock-grant-1',
        tenant_id: 'mock-tenant-1',
        vest_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        shares_vested: 2.083,
        pps_snapshot: 1.000,
        created_by: 'mock-user-1',
        created_at: new Date().toISOString()
      }
    ]
  },
  
  // Activity mock data
  activity: {
    items: [
      {
        id: 'mock-activity-1',
        date: new Date().toISOString().split('T')[0],
        type: 'grant',
        description: 'Initial equity grant',
        amount: 100.000,
        value: 100.000
      },
      {
        id: 'mock-activity-2',
        date: new Date().toISOString().split('T')[0],
        type: 'vesting',
        description: 'Shares vested',
        amount: 25.000,
        value: 25.000
      }
    ]
  },
  
  // Tenant mock data
  tenant: {
    tenant_id: 'mock-tenant-1',
    name: 'Acme Corp',
    currency: 'USD',
    timezone: 'America/New_York',
    created_at: new Date().toISOString()
  },
  
  // Audit logs mock data
  auditLogs: {
    items: [
      {
        log_id: 'mock-audit-1',
        tenant_id: 'mock-tenant-1',
        user_id: 'mock-user-1',
        action_type: 'GRANT_CREATE',
        entity_type: 'grant',
        entity_id: 'mock-grant-1',
        details: {
          before: null,
          after: {
            share_amount: 100.000
          }
        },
        created_at: new Date().toISOString()
      },
      {
        log_id: 'mock-audit-2',
        tenant_id: 'mock-tenant-1',
        user_id: 'mock-user-1',
        action_type: 'VESTING_CALCULATE',
        entity_type: 'vesting_event',
        entity_id: 'mock-vesting-1',
        details: {
          before: null,
          after: {
            shares_vested: 25.000
          }
        },
        created_at: new Date().toISOString()
      }
    ],
    pagination: {
      total_items: 2,
      total_pages: 1,
      current_page: 1,
      limit: 10
    }
  }
};

/**
 * Function to check if an API endpoint is enabled
 * @param {string} endpoint - The API endpoint to check
 * @returns {boolean} - Whether the endpoint is enabled
 */
export const isApiEnabled = (endpoint) => {
  if (!USE_MOCK_DATA) return true;
  
  return API_CONFIG[endpoint] !== false;
};

/**
 * Function to get mock data for an API endpoint
 * @param {string} endpoint - The API endpoint path (e.g., 'pps.current')
 * @returns {object|null} - Mock data for the endpoint or null if not found
 */
export const getMockData = (endpoint) => {
  if (!USE_MOCK_DATA) return null;
  
  const parts = endpoint.split('.');
  let data = MOCK_DATA;
  
  for (const part of parts) {
    if (!data[part]) return null;
    data = data[part];
  }
  
  return JSON.parse(JSON.stringify(data)); // Return a deep copy
}; 