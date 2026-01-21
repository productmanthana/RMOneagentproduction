/**
 * MS SQL Database Connection
 * Supports two separate databases:
 * - APP_MSSQL_URL: Application data (users, sessions, chats, etc.) - Optional, falls back to Aurora PostgreSQL
 * - CLIENT_MSSQL_URL: Client project data (POR table or configurable)
 */

import sql from 'mssql';

let clientPool: sql.ConnectionPool | null = null;

// Parse MS SQL connection URL into config object
function parseConnectionUrl(url: string): sql.config {
  // Expected format: mssql://user:password@server:port/database
  // or: Server=...;Database=...;User Id=...;Password=...;
  
  if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) {
    const parsed = new URL(url.replace('mssql://', 'http://').replace('sqlserver://', 'http://'));
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      server: parsed.hostname,
      port: parseInt(parsed.port) || 1433,
      database: parsed.pathname.replace('/', ''),
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 60000,
      },
      pool: {
        max: 20,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
  }
  
  // Parse connection string format: Server=...;Database=...;User Id=...;Password=...;
  const config: sql.config = {
    server: '',
    database: '',
    user: '',
    password: '',
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: 30000,
      requestTimeout: 60000,
    },
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
  
  const parts = url.split(';');
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    
    const keyLower = key.trim().toLowerCase();
    const val = value.trim();
    
    if (keyLower === 'server' || keyLower === 'data source') {
      // Handle server,port format
      if (val.includes(',')) {
        const [server, port] = val.split(',');
        config.server = server;
        config.port = parseInt(port) || 1433;
      } else {
        config.server = val;
      }
    } else if (keyLower === 'database' || keyLower === 'initial catalog') {
      config.database = val;
    } else if (keyLower === 'user id' || keyLower === 'uid' || keyLower === 'user') {
      config.user = val;
    } else if (keyLower === 'password' || keyLower === 'pwd') {
      config.password = val;
    } else if (keyLower === 'port') {
      config.port = parseInt(val) || 1433;
    }
  }
  
  return config;
}

// Get client database pool (for project data queries)
export async function getClientDbPool(): Promise<sql.ConnectionPool> {
  if (clientPool && clientPool.connected) {
    return clientPool;
  }
  
  const CLIENT_MSSQL_URL = process.env.CLIENT_MSSQL_URL;
  
  if (!CLIENT_MSSQL_URL) {
    throw new Error("CLIENT_MSSQL_URL environment variable is not set");
  }
  
  const config = parseConnectionUrl(CLIENT_MSSQL_URL);
  
  console.log(`🔌 Connecting to MS SQL client database: ${config.server}/${config.database}`);
  
  clientPool = new sql.ConnectionPool(config);
  
  clientPool.on('error', (err) => {
    console.error('MS SQL client pool error:', err);
  });
  
  await clientPool.connect();
  console.log('✅ Connected to MS SQL client database');
  
  return clientPool;
}

// Get the configured table name for project data
export function getClientTableName(): string {
  return process.env.CLIENT_TABLE_NAME || 'POR';
}

// Query the client database (for project data)
export async function queryClientDb(sqlQuery: string, params?: Record<string, any>, retries = 2): Promise<any[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const pool = await getClientDbPool();
      const request = pool.request();
      
      // Add parameters if provided
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value === null || value === undefined) {
            request.input(key, sql.NVarChar, null);
          } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
              request.input(key, sql.Int, value);
            } else {
              request.input(key, sql.Float, value);
            }
          } else if (value instanceof Date) {
            request.input(key, sql.DateTime, value);
          } else if (Array.isArray(value)) {
            // For arrays, join as comma-separated string for IN clauses
            request.input(key, sql.NVarChar, value.join(','));
          } else {
            request.input(key, sql.NVarChar, String(value));
          }
        }
      }
      
      const result = await request.query(sqlQuery);
      return result.recordset || [];
    } catch (error: any) {
      const isTransientError = 
        error.code === 'ESOCKET' ||
        error.code === 'ETIMEOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.message?.includes('timeout') ||
        error.message?.includes('Connection lost');
      
      if (attempt === retries || !isTransientError) {
        console.error(`MS SQL query failed after ${attempt + 1} attempt(s):`, error);
        throw error;
      }
      
      console.warn(`MS SQL connection attempt ${attempt + 1} failed, retrying...`, error.message);
      
      // Reset pool on connection errors
      if (clientPool) {
        try {
          await clientPool.close();
        } catch (closeError) {
          console.warn('Error closing pool:', closeError);
        }
        clientPool = null;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (attempt + 1), 3000)));
    }
  }
  
  throw new Error('MS SQL query failed after all retry attempts');
}

// Close all database connections
export async function closeMssqlConnections(): Promise<void> {
  if (clientPool) {
    await clientPool.close();
    clientPool = null;
    console.log('✅ MS SQL client connection closed');
  }
}

// Check if MS SQL is configured
export function isMssqlConfigured(): boolean {
  return !!process.env.CLIENT_MSSQL_URL;
}

// Replace table name placeholder in query ("POR" -> configured table)
export function replaceTableName(sqlQuery: string): string {
  const tableName = getClientTableName();
  return sqlQuery.replace(/"POR"/g, `"${tableName}"`);
}

// Convert params array to named params object for MS SQL
function convertParamsToObject(params: any[]): Record<string, any> {
  const namedParams: Record<string, any> = {};
  params.forEach((value, index) => {
    namedParams[`p${index + 1}`] = value;
  });
  return namedParams;
}

// Main query function - takes array params and replaces table name
export async function queryExternalDb(sqlQuery: string, params: any[] = []): Promise<any[]> {
  const query = replaceTableName(sqlQuery);
  const namedParams = params.length > 0 ? convertParamsToObject(params) : {};
  return queryClientDb(query, namedParams);
}

// Identity function for backward compatibility (SQL already uses @p format)
export function convertPlaceholders(sql: string): string {
  return sql;
}
