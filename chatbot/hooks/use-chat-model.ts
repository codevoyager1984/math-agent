'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from 'usehooks-ts';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';

const CHAT_MODEL_STORAGE_KEY = 'chat-model';

export function useChatModel() {
  const [localStorageModel, setLocalStorageModel] = useLocalStorage(
    CHAT_MODEL_STORAGE_KEY,
    DEFAULT_CHAT_MODEL
  );
  
  const [currentModel, setCurrentModel] = useState<string>(DEFAULT_CHAT_MODEL);
  const [isDeepThinking, setIsDeepThinking] = useState<boolean>(false);

  // 从 localStorage 初始化模型状态
  useEffect(() => {
    const model = localStorageModel || DEFAULT_CHAT_MODEL;
    setCurrentModel(model);
    setIsDeepThinking(model === 'chat-model-reasoning');
  }, [localStorageModel]);

  // 更新模型
  const updateModel = useCallback((modelId: string) => {
    setCurrentModel(modelId);
    setLocalStorageModel(modelId);
    setIsDeepThinking(modelId === 'chat-model-reasoning');
  }, [setLocalStorageModel]);

  // 切换深度思考模式
  const toggleDeepThinking = useCallback((enabled: boolean) => {
    const modelId = enabled ? 'chat-model-reasoning' : 'chat-model';
    updateModel(modelId);
  }, [updateModel]);

  return {
    currentModel,
    isDeepThinking,
    updateModel,
    toggleDeepThinking,
  };
}
