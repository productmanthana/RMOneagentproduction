/**
 * Unified Storage Layer
 * Uses MS SQL Server exclusively for all app data
 */

import { isAppMssqlConfigured, initAppMssqlPool } from './mssql-app-db';
import { mssqlStorage, MssqlStorage } from './mssql-storage';
import type { Chat, Message, InsertChat, InsertMessage, User, UpsertUser, UpdateMessageFAQ, FAQSampleQuestion, ErrorLog, InsertErrorLog, UpdateErrorLog } from '@shared/schema';

// Track initialization state
let isInitialized = false;
let sqlStorage: MssqlStorage | null = null;

/**
 * Initialize the unified storage layer
 */
export async function initUnifiedStorage(): Promise<void> {
  if (isInitialized) return;

  if (!isAppMssqlConfigured()) {
    throw new Error('APP_MSSQL_URL is required - MS SQL is the only supported database');
  }

  console.log('📊 Initializing MS SQL for app data...');
  const pool = await initAppMssqlPool();
  if (!pool) {
    throw new Error('Failed to connect to MS SQL app database');
  }
  
  sqlStorage = mssqlStorage;
  console.log('✅ Using MS SQL for app data');
  isInitialized = true;
}

/**
 * Get the active storage instance
 */
function getStorage(): MssqlStorage {
  if (!isInitialized || !sqlStorage) {
    throw new Error('Storage not initialized. Call initUnifiedStorage() first.');
  }
  return sqlStorage;
}

/**
 * Check if using MS SQL for app data
 */
export function isUsingMssqlForApp(): boolean {
  return true;
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED STORAGE API - MS SQL Only
// ═══════════════════════════════════════════════════════════════

export const unifiedStorage = {
  // Chat operations
  listChats: async (sessionId: string): Promise<Chat[]> => {
    return getStorage().listChats(sessionId);
  },

  getChat: async (chatId: string): Promise<Chat | undefined> => {
    return getStorage().getChat(chatId);
  },

  createChat: async (chat: InsertChat): Promise<Chat> => {
    return getStorage().createChat(chat);
  },

  updateChatTitle: async (chatId: string, title: string): Promise<Chat | undefined> => {
    return getStorage().updateChatTitle(chatId, title);
  },

  deleteChat: async (chatId: string): Promise<void> => {
    return getStorage().deleteChat(chatId);
  },

  // Message operations
  listMessages: async (chatId: string): Promise<Message[]> => {
    return getStorage().listMessages(chatId);
  },

  getMessageById: async (chatId: string, messageId: string): Promise<Message | null> => {
    return getStorage().getMessageById(chatId, messageId);
  },

  createMessage: async (message: InsertMessage): Promise<Message> => {
    return getStorage().createMessage(message);
  },

  updateMessageAIAnalysis: async (chatId: string, messageId: string, aiAnalysisMessages: any[]): Promise<Message> => {
    return getStorage().updateMessageAIAnalysis(chatId, messageId, aiAnalysisMessages);
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    return getStorage().deleteMessage(messageId);
  },

  updateMessageFAQ: async (chatId: string, messageId: string, update: UpdateMessageFAQ, userId?: string): Promise<Message> => {
    return getStorage().updateMessageFAQ(chatId, messageId, update, userId);
  },

  // FAQ operations
  getFAQSampleQuestions: async (userId?: string): Promise<FAQSampleQuestion[]> => {
    return getStorage().getFAQMessages(userId);
  },

  // User operations
  getUserByEmail: async (email: string): Promise<User | null> => {
    return getStorage().getUserByEmail(email);
  },

  getUserById: async (id: string): Promise<User | null> => {
    return getStorage().getUserById(id);
  },

  createUser: async (user: UpsertUser): Promise<User> => {
    return getStorage().createUser(user);
  },

  updateUserRole: async (email: string, role: string): Promise<void> => {
    return getStorage().updateUserRole(email, role);
  },

  // Error log operations
  createErrorLog: async (log: InsertErrorLog): Promise<ErrorLog> => {
    return getStorage().createErrorLog(log);
  },

  getErrorLogs: async (userEmail?: string): Promise<ErrorLog[]> => {
    return getStorage().getErrorLogs(userEmail);
  },

  updateErrorLog: async (id: string, update: UpdateErrorLog): Promise<ErrorLog | null> => {
    return getStorage().updateErrorLog(id, update);
  },

  deleteErrorLog: async (id: string): Promise<void> => {
    return getStorage().deleteErrorLog(id);
  },

  // Activity log operations
  createActivityLog: async (log: { user_id?: string; user_email: string; event_type: string; metadata?: any }): Promise<void> => {
    return getStorage().createActivityLog(log);
  },

  getActivityLogs: async (limit: number = 100): Promise<any[]> => {
    return getStorage().getActivityLogs(limit);
  },

  // Additional operations
  getFirstUserMessage: async (chatId: string): Promise<Message | null> => {
    return getStorage().getFirstUserMessage(chatId);
  },

  removeFAQStatus: async (messageId: string): Promise<void> => {
    return getStorage().removeFAQStatus(messageId);
  },

  importChats: async (sessionId: string, chatsData: any[]): Promise<void> => {
    return getStorage().importChats(sessionId, chatsData);
  },

  listErrorLogs: async (userEmail?: string): Promise<ErrorLog[]> => {
    if (userEmail) {
      return getStorage().listErrorLogsByUser(userEmail);
    }
    return getStorage().listErrorLogs();
  },

  listErrorLogsByChat: async (chatId: string): Promise<ErrorLog[]> => {
    return getStorage().listErrorLogsByChat(chatId);
  },

  listErrorLogsByUser: async (userEmail: string): Promise<ErrorLog[]> => {
    return getStorage().listErrorLogsByUser(userEmail);
  },

  updateErrorLogScreenshot: async (id: string, screenshotFilename: string, screenshotUrl: string): Promise<ErrorLog | null> => {
    return getStorage().updateErrorLogScreenshot(id, screenshotFilename, screenshotUrl);
  },
};
