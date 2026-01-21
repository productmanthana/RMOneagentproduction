/**
 * RAG Vector Store - Pinecone Implementation
 * Stores atomic documents (functions, schemas, examples) for improved query classification
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIClient } from './openai-client';
import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface VectorDocument {
  id: string;
  type: 'function' | 'schema' | 'example' | 'parameter';
  content: any;
  metadata: {
    atomic: boolean;
    complete: boolean;
    category: string;
    [key: string]: any;
  };
}

export interface RetrievalResult {
  document: VectorDocument;
  score: number;
}

export interface RAGContext {
  functions: any[];
  schemas: any[];
  examples: any[];
  parameters: any[];
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════
// RAG STORE CLASS
// ═══════════════════════════════════════════════════════════════

export class RAGVectorStore {
  private pinecone: Pinecone;
  private indexName: string;
  private namespace: string;
  private openaiClient: OpenAIClient;
  private initialized: boolean = false;
  private embeddingClient: OpenAI;
  private embeddingModel: string;

  constructor(
    apiKey: string,
    indexName: string = 'query-functions',
    namespace: string = 'default',
    openaiClient: OpenAIClient,
    embeddingConfig: {
      openaiApiKey: string;
      model?: string;
    }
  ) {
    this.pinecone = new Pinecone({ apiKey });
    this.indexName = indexName;
    this.namespace = namespace;
    this.openaiClient = openaiClient;
    this.embeddingClient = new OpenAI({ apiKey: embeddingConfig.openaiApiKey });
    this.embeddingModel = embeddingConfig.model || 'text-embedding-3-large';
  }

  /**
   * Initialize Pinecone index (create if doesn't exist)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[RAG] Initializing Pinecone...');
      
      // List existing indexes
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        console.log(`[RAG] Creating index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: 3072, // Azure OpenAI text-embedding-3-large
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1'
            }
          }
        });

        // Wait for index to be ready
        console.log('[RAG] Waiting for index to be ready...');
        await this.waitForIndexReady();
      }

      this.initialized = true;
      console.log('[RAG] ✓ Pinecone initialized successfully');
    } catch (error) {
      console.error('[RAG] Failed to initialize Pinecone:', error);
      throw error;
    }
  }

  /**
   * Wait for index to become ready
   */
  private async waitForIndexReady(maxWaitSeconds: number = 60): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      try {
        const description = await this.pinecone.describeIndex(this.indexName);
        if (description.status?.ready) {
          return;
        }
      } catch (error) {
        // Index might not be visible yet
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Index ${this.indexName} did not become ready within ${maxWaitSeconds}s`);
  }

  /**
   * Generate embedding using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.embeddingClient.embeddings.create({
        model: this.embeddingModel,
        input: text,
        dimensions: 3072
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('[RAG] Embedding generation failed:', error);
      throw error;
    }
  }

  /**
   * Upsert atomic documents to Pinecone
   */
  async upsertDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`[RAG] Upserting ${documents.length} documents...`);
      const index = this.pinecone.index(this.indexName);

      // Process in batches of 100 (Pinecone limit)
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        // Generate embeddings and prepare vectors
        const vectors = await Promise.all(
          batch.map(async (doc) => {
            const text = this.documentToText(doc);
            const embedding = await this.generateEmbedding(text);
            
            return {
              id: doc.id,
              values: embedding,
              metadata: {
                type: doc.type,
                atomic: doc.metadata.atomic,
                complete: doc.metadata.complete,
                category: doc.metadata.category,
                content: JSON.stringify(doc.content)
              }
            };
          })
        );

        // Upsert to Pinecone
        await index.namespace(this.namespace).upsert(vectors);
        console.log(`[RAG] Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);
      }

      console.log('[RAG] ✓ All documents upserted successfully');
    } catch (error) {
      console.error('[RAG] Failed to upsert documents:', error);
      throw error;
    }
  }

  /**
   * Convert document to searchable text
   */
  private documentToText(doc: VectorDocument): string {
    const parts: string[] = [];

    if (doc.type === 'function') {
      parts.push(`Function: ${doc.content.function_name}`);
      parts.push(`Description: ${doc.content.description}`);
      parts.push(`Parameters: ${doc.content.parameters?.join(', ')}`);
      if (doc.content.examples) {
        parts.push(`Examples: ${doc.content.examples.join('; ')}`);
      }
    } else if (doc.type === 'schema') {
      parts.push(`Field: ${doc.content.field}`);
      parts.push(`Meaning: ${doc.content.meaning}`);
      if (doc.content.categories) {
        parts.push(`Categories: ${JSON.stringify(doc.content.categories)}`);
      }
    } else if (doc.type === 'example') {
      parts.push(`Question: ${doc.content.question}`);
      parts.push(`Function: ${doc.content.function}`);
      parts.push(`Parameters: ${JSON.stringify(doc.content.params)}`);
    } else if (doc.type === 'parameter') {
      parts.push(`Term: ${doc.content.user_term}`);
      parts.push(`Meaning: ${doc.content.meaning}`);
      if (doc.content.aliases) {
        parts.push(`Aliases: ${doc.content.aliases.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Retrieve relevant context for a question
   */
  async retrieveContext(question: string, topK: number = 5): Promise<RAGContext> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`[RAG] Retrieving context for: "${question}"`);
      
      // Generate embedding for question
      const questionEmbedding = await this.generateEmbedding(question);
      
      // Query Pinecone
      const index = this.pinecone.index(this.indexName);
      const queryResponse = await index.namespace(this.namespace).query({
        vector: questionEmbedding,
        topK,
        includeMetadata: true,
        filter: {
          atomic: { $eq: true },
          complete: { $eq: true }
        }
      });

      // Parse results
      const functions: any[] = [];
      const schemas: any[] = [];
      const examples: any[] = [];
      const parameters: any[] = [];
      let totalScore = 0;

      for (const match of queryResponse.matches || []) {
        if (!match.metadata) continue;

        const doc = {
          id: match.id,
          type: match.metadata.type,
          content: JSON.parse(match.metadata.content as string),
          score: match.score || 0
        };

        totalScore += doc.score;

        switch (doc.type) {
          case 'function':
            functions.push(doc.content);
            break;
          case 'schema':
            schemas.push(doc.content);
            break;
          case 'example':
            examples.push(doc.content);
            break;
          case 'parameter':
            parameters.push(doc.content);
            break;
        }
      }

      // Calculate confidence score (average similarity)
      const confidence = queryResponse.matches.length > 0 
        ? totalScore / queryResponse.matches.length 
        : 0;

      console.log(`[RAG] Retrieved: ${functions.length} functions, ${schemas.length} schemas, ${examples.length} examples, ${parameters.length} parameters`);
      console.log(`[RAG] Confidence: ${(confidence * 100).toFixed(1)}%`);

      return {
        functions,
        schemas,
        examples,
        parameters,
        confidence
      };
    } catch (error) {
      console.error('[RAG] Failed to retrieve context:', error);
      // Return empty context on error
      return {
        functions: [],
        schemas: [],
        examples: [],
        parameters: [],
        confidence: 0
      };
    }
  }

  /**
   * Clear all documents from the index
   */
  async clearIndex(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('[RAG] Clearing index...');
      const index = this.pinecone.index(this.indexName);
      
      // Wait a bit for the index to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await index.namespace(this.namespace).deleteAll();
      console.log('[RAG] ✓ Index cleared');
    } catch (error: any) {
      // If the index is newly created and empty, deleteAll might fail with 404
      // This is okay - we can continue
      if (error.message?.includes('404')) {
        console.log('[RAG] ⚠️  Index is empty (404 on delete) - continuing...');
        return;
      }
      console.error('[RAG] Failed to clear index:', error);
      throw error;
    }
  }
}
