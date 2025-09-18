'use client';

import { useEffect } from 'react';
import '@/lib/i18n';

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    // 确保 i18n 已初始化
    import('@/lib/i18n');
  }, []);

  return <>{children}</>;
}
