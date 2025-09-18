export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'models.deepSeekChat.name',
    description: 'models.deepSeekChat.description',
  },
  {
    id: 'chat-model-reasoning',
    name: 'models.deepSeekReasoner.name',
    description: 'models.deepSeekReasoner.description',
  },
];
