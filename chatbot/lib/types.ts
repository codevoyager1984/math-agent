import { z } from 'zod';
import type { getWeather } from './ai/tools/get-weather';
import type { createDocument } from './ai/tools/create-document';
import type { updateDocument } from './ai/tools/update-document';
import type { requestSuggestions } from './ai/tools/request-suggestions';
import type { searchKnowledgePoints } from './ai/tools/search-knowledge-points';
import type { InferUITool, UIMessage } from 'ai';

import type { ArtifactKind } from '@/components/artifact';
import type { Suggestion } from './db/schema';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;
type searchKnowledgePointsTool = InferUITool<
  ReturnType<typeof searchKnowledgePoints>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
  searchKnowledgePoints: searchKnowledgePointsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  'knowledge-search-start': {
    query: string;
    category?: string;
  };
  'knowledge-search-result': {
    query: string;
    knowledgePoints: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      examples: Array<{
        question: string;
        solution: string;
        difficulty: string;
      }>;
      tags: string[];
      relevanceScore: number;
    }>;
    totalFound: number;
  };
  'knowledge-search-finish': null;
  'knowledge-search-error': {
    error: string;
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
  ocrText?: string;
  ocrLoading?: boolean;
}
