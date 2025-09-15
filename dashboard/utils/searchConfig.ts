export interface SearchConfig {
  searchMode: 'vector' | 'text' | 'hybrid';
  vectorWeight: number;
  textWeight: number;
  enableRerank: boolean;
  rerankMethod: 'cross_encoder' | 'llm';
  rerankTopK?: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  searchMode: 'hybrid',
  vectorWeight: 0.6,
  textWeight: 0.4,
  enableRerank: true,
  rerankMethod: 'llm',
  rerankTopK: undefined,
};

const STORAGE_KEY = 'knowledge_base_search_config';

export function saveSearchConfig(config: SearchConfig): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  } catch (error) {
    console.warn('Failed to save search config to localStorage:', error);
  }
}

export function loadSearchConfig(): SearchConfig {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SearchConfig>;
        return {
          ...DEFAULT_SEARCH_CONFIG,
          ...parsed,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load search config from localStorage:', error);
  }

  return DEFAULT_SEARCH_CONFIG;
}

export function resetSearchConfig(): SearchConfig {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to reset search config in localStorage:', error);
  }

  return DEFAULT_SEARCH_CONFIG;
}

export function isConfigDifferentFromDefault(config: SearchConfig): boolean {
  return (
    config.searchMode !== DEFAULT_SEARCH_CONFIG.searchMode ||
    config.vectorWeight !== DEFAULT_SEARCH_CONFIG.vectorWeight ||
    config.textWeight !== DEFAULT_SEARCH_CONFIG.textWeight ||
    config.enableRerank !== DEFAULT_SEARCH_CONFIG.enableRerank ||
    config.rerankMethod !== DEFAULT_SEARCH_CONFIG.rerankMethod ||
    config.rerankTopK !== DEFAULT_SEARCH_CONFIG.rerankTopK
  );
}

export function validateSearchConfig(config: Partial<SearchConfig>): SearchConfig {
  return {
    searchMode: ['vector', 'text', 'hybrid'].includes(config.searchMode || '')
      ? (config.searchMode as 'vector' | 'text' | 'hybrid')
      : DEFAULT_SEARCH_CONFIG.searchMode,
    vectorWeight: typeof config.vectorWeight === 'number' &&
      config.vectorWeight >= 0 && config.vectorWeight <= 1
      ? config.vectorWeight
      : DEFAULT_SEARCH_CONFIG.vectorWeight,
    textWeight: typeof config.textWeight === 'number' &&
      config.textWeight >= 0 && config.textWeight <= 1
      ? config.textWeight
      : DEFAULT_SEARCH_CONFIG.textWeight,
    enableRerank: typeof config.enableRerank === 'boolean'
      ? config.enableRerank
      : DEFAULT_SEARCH_CONFIG.enableRerank,
    rerankMethod: ['cross_encoder', 'llm'].includes(config.rerankMethod || '')
      ? (config.rerankMethod as 'cross_encoder' | 'llm')
      : DEFAULT_SEARCH_CONFIG.rerankMethod,
    rerankTopK: typeof config.rerankTopK === 'number' && config.rerankTopK > 0
      ? config.rerankTopK
      : DEFAULT_SEARCH_CONFIG.rerankTopK,
  };
}