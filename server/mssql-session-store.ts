/**
 * MS SQL Server Session Store for express-session
 * Replaces connect-pg-simple when using MS SQL for app data
 */

import { Store } from 'express-session';
import { getAppPool } from './mssql-app-db';

interface SessionData {
  cookie: any;
  [key: string]: any;
}

export class MssqlSessionStore extends Store {
  private ttl: number;

  constructor(options: { ttl?: number } = {}) {
    super();
    this.ttl = options.ttl || 86400; // Default 24 hours in seconds
  }

  // Get session by ID
  async get(sid: string, callback: (err: any, session?: SessionData | null) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        return callback(new Error('Database not connected'));
      }

      const result = await pool.request()
        .input('sid', sid)
        .query(`
          SELECT sess FROM sessions 
          WHERE sid = @sid AND expire > GETDATE()
        `);

      if (result.recordset.length === 0) {
        return callback(null, null);
      }

      const sess = result.recordset[0].sess;
      const session = typeof sess === 'string' ? JSON.parse(sess) : sess;
      callback(null, session);
    } catch (err) {
      callback(err);
    }
  }

  // Set session
  async set(sid: string, session: SessionData, callback?: (err?: any) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        if (callback) callback(new Error('Database not connected'));
        return;
      }

      const maxAge = session.cookie?.maxAge || this.ttl * 1000;
      const expire = new Date(Date.now() + maxAge);
      const sessJson = JSON.stringify(session);

      // Upsert pattern for MS SQL
      await pool.request()
        .input('sid', sid)
        .input('sess', sessJson)
        .input('expire', expire)
        .query(`
          MERGE sessions AS target
          USING (SELECT @sid AS sid) AS source
          ON target.sid = source.sid
          WHEN MATCHED THEN
            UPDATE SET sess = @sess, expire = @expire
          WHEN NOT MATCHED THEN
            INSERT (sid, sess, expire) VALUES (@sid, @sess, @expire);
        `);

      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  // Destroy session
  async destroy(sid: string, callback?: (err?: any) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        if (callback) callback(new Error('Database not connected'));
        return;
      }

      await pool.request()
        .input('sid', sid)
        .query('DELETE FROM sessions WHERE sid = @sid');

      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  // Touch session (update expiry)
  async touch(sid: string, session: SessionData, callback?: (err?: any) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        if (callback) callback(new Error('Database not connected'));
        return;
      }

      const maxAge = session.cookie?.maxAge || this.ttl * 1000;
      const expire = new Date(Date.now() + maxAge);

      await pool.request()
        .input('sid', sid)
        .input('expire', expire)
        .query('UPDATE sessions SET expire = @expire WHERE sid = @sid');

      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  // Clear all sessions
  async clear(callback?: (err?: any) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        if (callback) callback(new Error('Database not connected'));
        return;
      }

      await pool.request().query('DELETE FROM sessions');
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err);
    }
  }

  // Get count of sessions
  async length(callback: (err: any, length?: number) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        return callback(new Error('Database not connected'));
      }

      const result = await pool.request()
        .query('SELECT COUNT(*) as count FROM sessions WHERE expire > GETDATE()');
      
      callback(null, result.recordset[0].count);
    } catch (err) {
      callback(err);
    }
  }

  // Get all sessions
  async all(callback: (err: any, sessions?: SessionData[] | { [sid: string]: SessionData } | null) => void): Promise<void> {
    try {
      const pool = getAppPool();
      if (!pool) {
        return callback(new Error('Database not connected'));
      }

      const result = await pool.request()
        .query('SELECT sid, sess FROM sessions WHERE expire > GETDATE()');
      
      const sessions: { [sid: string]: SessionData } = {};
      for (const row of result.recordset) {
        sessions[row.sid] = typeof row.sess === 'string' ? JSON.parse(row.sess) : row.sess;
      }
      
      callback(null, sessions);
    } catch (err) {
      callback(err);
    }
  }
}
