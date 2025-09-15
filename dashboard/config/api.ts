/**
 * API Configuration
 * Centralized configuration for all API endpoints
 */

// RAG Server URL configuration
export const RAG_SERVER_URL = process.env.RAG_SERVER_URL || 'http://45.78.228.239:18080';

// API endpoints
export const API_ENDPOINTS = {
  RAG: {
    PARSE_JSON: `${RAG_SERVER_URL}/api/knowledge-base/parse-json`,
    CHAT_STREAM: (sessionId: string) => `${RAG_SERVER_URL}/api/knowledge-base/chat-stream/${sessionId}`,
    CHAT_SESSION: (sessionId: string) => `${RAG_SERVER_URL}/api/knowledge-base/chat-session/${sessionId}`,
  },
} as const;

export default {
  RAG_SERVER_URL,
  API_ENDPOINTS,
};