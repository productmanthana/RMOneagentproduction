/**
 * MS SQL Server Connection for Application Data
 * Handles users, sessions, chats, messages, error_logs, user_activity_logs
 */

import sql from 'mssql';

// Connection configuration for app database
const APP_MSSQL_URL = process.env.APP_MSSQL_URL;

let appPool: sql.ConnectionPool | null = null;

// Parse connection string to config object
function parseConnectionString(connectionString: string): sql.config {
  const config: sql.config = {
    server: '', // Will be set from connection string
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  // Parse connection string format: Server=host;Database=db;User Id=user;Password=pass
  const parts = connectionString.split(';');
  for (const part of parts) {
    const [key, ...valueParts] = part.split('=');
    const value = valueParts.join('='); // Handle passwords with = in them
    const keyLower = key?.toLowerCase().trim();
    
    if (keyLower === 'server' || keyLower === 'data source') {
      // Handle Server=host,port format
      const [server, port] = value.split(',');
      config.server = server;
      if (port) config.port = parseInt(port, 10);
    } else if (keyLower === 'database' || keyLower === 'initial catalog') {
      config.database = value;
    } else if (keyLower === 'user id' || keyLower === 'uid') {
      config.user = value;
    } else if (keyLower === 'password' || keyLower === 'pwd') {
      config.password = value;
    } else if (keyLower === 'port') {
      config.port = parseInt(value, 10);
    }
  }

  // Default port if not specified
  if (!config.port) {
    config.port = 1433;
  }

  return config;
}

// Initialize app database connection pool
export async function initAppMssqlPool(): Promise<sql.ConnectionPool | null> {
  if (!APP_MSSQL_URL) {
    console.log('⚠️  APP_MSSQL_URL not configured - app database not available');
    return null;
  }

  if (appPool) {
    return appPool;
  }

  try {
    const config = parseConnectionString(APP_MSSQL_URL);
    console.log(`📊 Connecting to MS SQL app database at ${config.server}...`);
    
    // If connecting to master, create the app database first
    if (config.database?.toLowerCase() === 'master') {
      console.log('📊 Connected to master - creating rmchatbot_app database...');
      const masterPool = await sql.connect(config);
      
      // Create database if not exists
      await masterPool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'rmchatbot_app')
        BEGIN
          CREATE DATABASE rmchatbot_app;
        END
      `);
      console.log('✅ Database rmchatbot_app created/verified');
      
      // Close master connection
      await masterPool.close();
      
      // Reconnect to the new database
      config.database = 'rmchatbot_app';
    }
    
    appPool = await sql.connect(config);
    console.log(`✅ MS SQL app database connected to ${config.database}`);
    
    // Initialize tables
    await initializeTables();
    
    return appPool;
  } catch (error) {
    console.error('❌ Failed to connect to MS SQL app database:', error);
    return null;
  }
}

// Get the app database pool
export function getAppPool(): sql.ConnectionPool | null {
  return appPool;
}

// Check if app MS SQL is configured
export function isAppMssqlConfigured(): boolean {
  return !!APP_MSSQL_URL;
}

// Initialize all app tables
async function initializeTables(): Promise<void> {
  if (!appPool) return;

  try {
    // Create sessions table
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'sessions')
      CREATE TABLE sessions (
        sid NVARCHAR(255) PRIMARY KEY,
        sess NVARCHAR(MAX) NOT NULL,
        expire DATETIME2 NOT NULL
      );
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_session_expire')
      CREATE INDEX IDX_session_expire ON sessions(expire);
    `);

    // Create users table
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
      CREATE TABLE users (
        id NVARCHAR(255) PRIMARY KEY DEFAULT NEWID(),
        email NVARCHAR(255) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        first_name NVARCHAR(255),
        last_name NVARCHAR(255),
        profile_image_url NVARCHAR(500),
        role NVARCHAR(50) DEFAULT 'user',
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      );
    `);

    // Create chats table
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'chats')
      CREATE TABLE chats (
        id NVARCHAR(255) PRIMARY KEY,
        session_id NVARCHAR(255) NOT NULL,
        title NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        faq_category NVARCHAR(255)
      );
    `);

    // Create messages table
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'messages')
      CREATE TABLE messages (
        id NVARCHAR(255) PRIMARY KEY,
        chat_id NVARCHAR(255) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        timestamp DATETIME2 DEFAULT GETDATE(),
        response NVARCHAR(MAX),
        ai_analysis_messages NVARCHAR(MAX),
        is_faq BIT DEFAULT 0,
        faq_category NVARCHAR(255),
        faq_display_text NVARCHAR(MAX),
        user_id NVARCHAR(255)
      );
    `);

    // Add user_id column to messages table if it doesn't exist (for per-user FAQ visibility)
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('messages') AND name = 'user_id')
      ALTER TABLE messages ADD user_id NVARCHAR(255);
    `);

    // Create error_logs table
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'error_logs')
      CREATE TABLE error_logs (
        id NVARCHAR(255) PRIMARY KEY,
        session_id NVARCHAR(255) NOT NULL,
        user_id NVARCHAR(255),
        user_email NVARCHAR(255),
        chat_id NVARCHAR(255) NOT NULL,
        message_id NVARCHAR(255),
        question NVARCHAR(MAX) NOT NULL,
        error_message NVARCHAR(MAX),
        user_comment NVARCHAR(MAX) NOT NULL,
        developer_comment NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'pending',
        screenshot_filename NVARCHAR(255),
        screenshot_url NVARCHAR(500),
        created_at DATETIME2 DEFAULT GETDATE()
      );
    `);

    // Create user_hidden_faqs table for persistent hidden FAQ tracking per user
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'user_hidden_faqs')
      CREATE TABLE user_hidden_faqs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id NVARCHAR(255) NOT NULL,
        faq_text NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      );
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IDX_user_hidden_faqs_user_id')
      CREATE INDEX IDX_user_hidden_faqs_user_id ON user_hidden_faqs(user_id);
    `);

    console.log('✅ MS SQL app tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize MS SQL app tables:', error);
    throw error;
  }
}

// Execute a query on the app database
export async function queryAppDb<T = any>(
  queryText: string,
  params?: Record<string, any>
): Promise<T[]> {
  if (!appPool) {
    throw new Error('App database not connected');
  }

  const request = appPool.request();
  
  // Add parameters if provided
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query(queryText);
  return result.recordset as T[];
}

// Close the connection pool
export async function closeAppMssqlPool(): Promise<void> {
  if (appPool) {
    await appPool.close();
    appPool = null;
    console.log('📊 MS SQL app database connection closed');
  }
}
