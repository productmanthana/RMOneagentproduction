/**
 * localStorage-based chat persistence
 * Chats persist until browser data is cleared
 */

export interface StoredChat {
  id: string;
  title: string;
  created_at: string;
  messages: StoredMessage[];
}

export interface StoredMessage {
  id: string;
  type: "user" | "bot";
  content: string;
  response?: any;
  ai_analysis_messages?: Array<{
    id: string;
    type: "user" | "assistant";
    content: string;
    response?: any;
  }>;
}

const STORAGE_KEY = "rmone_chats";
const SIZE_ERROR_KEY = "rmone_chats_size_errors";

class ChatStorage {
  private getChats(): StoredChat[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load chats from localStorage:", error);
      return [];
    }
  }

  private saveChats(chats: StoredChat[]): { success: boolean; isQuotaError: boolean } {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
      return { success: true, isQuotaError: false };
    } catch (error) {
      console.error("Failed to save chats to localStorage:", error);
      // Check if it's specifically a quota exceeded error
      const isQuotaError = error instanceof DOMException && 
          (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      return { success: false, isQuotaError };
    }
  }

  private markChatAsTooLarge(chatId: string): void {
    try {
      const sizeErrors = this.getSizeErrors();
      sizeErrors.add(chatId);
      localStorage.setItem(SIZE_ERROR_KEY, JSON.stringify(Array.from(sizeErrors)));
    } catch (error) {
      console.error("Failed to mark chat as too large:", error);
    }
  }

  private getSizeErrors(): Set<string> {
    try {
      const data = localStorage.getItem(SIZE_ERROR_KEY);
      return data ? new Set(JSON.parse(data)) : new Set();
    } catch (error) {
      return new Set();
    }
  }

  isChatTooLarge(chatId: string): boolean {
    return this.getSizeErrors().has(chatId);
  }

  getAllChats(): StoredChat[] {
    return this.getChats();
  }

  getChat(chatId: string): StoredChat | null {
    const chats = this.getChats();
    return chats.find(chat => chat.id === chatId) || null;
  }

  createChat(title: string): StoredChat {
    const chats = this.getChats();
    const newChat: StoredChat = {
      id: Date.now().toString(),
      title: title,
      created_at: new Date().toISOString(),
      messages: []
    };
    chats.unshift(newChat); // Add to beginning
    const result = this.saveChats(chats);
    
    // Throw specific error if quota exceeded
    if (!result.success && result.isQuotaError) {
      // Remove the chat we just added since it couldn't be saved
      chats.shift();
      const error = new Error("QUOTA_EXCEEDED");
      error.name = "QuotaExceededError";
      throw error;
    }
    
    return newChat;
  }

  addMessage(chatId: string, message: StoredMessage): void {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      chat.messages.push(message);
      const result = this.saveChats(chats);
      // Only mark as too large if it's actually a quota error
      if (!result.success && result.isQuotaError) {
        this.markChatAsTooLarge(chatId);
      }
    }
  }

  updateMessage(chatId: string, messageId: string, updates: Partial<StoredMessage>): void {
    const chats = this.getChats();
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const messageIndex = chat.messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        chat.messages[messageIndex] = {
          ...chat.messages[messageIndex],
          ...updates
        };
        const result = this.saveChats(chats);
        // Only mark as too large if it's actually a quota error
        if (!result.success && result.isQuotaError) {
          this.markChatAsTooLarge(chatId);
        }
      }
    }
  }

  deleteChat(chatId: string): void {
    const chats = this.getChats();
    const filtered = chats.filter(c => c.id !== chatId);
    this.saveChats(filtered);
  }

  deleteChats(chatIds: string[]): void {
    const chats = this.getChats();
    const filtered = chats.filter(c => !chatIds.includes(c.id));
    this.saveChats(filtered);
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const chatStorage = new ChatStorage();
