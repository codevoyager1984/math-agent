export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'AI Chat Model',
    description: 'Advanced AI model with strong reasoning and coding capabilities',
  },
  {
    id: 'chat-model-reasoning',
    name: 'AI Reasoning Model',
    description: 'Advanced reasoning model that shows step-by-step thinking process',
  },
];
