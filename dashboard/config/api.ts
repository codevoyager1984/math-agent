/**
 * API Configuration
 * Centralized configuration for all API endpoints
 */

import { API_DOMAIN } from "@/api/base";

// RAG Server URL configuration
// API endpoints
export const API_ENDPOINTS = {
  RAG: {
    PARSE_JSON: `${API_DOMAIN}/api/knowledge-base/parse-json`,
    CHAT_STREAM: (sessionId: string) => `${API_DOMAIN}/api/knowledge-base/chat-stream/${sessionId}`,
    CHAT_SESSION: (sessionId: string) => `${API_DOMAIN}/api/knowledge-base/chat-session/${sessionId}`,
  },
} as const;

export default {
  API_DOMAIN,
  API_ENDPOINTS,
};