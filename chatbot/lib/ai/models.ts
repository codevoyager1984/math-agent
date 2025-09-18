export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'DeepSeek Chat',
    description: 'Advanced AI model with strong reasoning and coding capabilities',
  },
  {
    id: 'chat-model-reasoning',
    name: 'DeepSeek Reasoner',
    description: 'Advanced reasoning model that shows step-by-step thinking process',
  },
];
