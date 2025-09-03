'use client';

import { useEffect, useState } from 'react';
import { createTheme, MantineProvider } from '@mantine/core';
import { createMantineTheme, useThemeStyle } from '../theme';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { style: themeStyle } = useThemeStyle();
  const [isMounted, setIsMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() =>
    createTheme(createMantineTheme(themeStyle))
  );

  // 处理客户端水合
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 在主题风格变化时更新主题
  useEffect(() => {
    if (isMounted) {
      // 创建新的主题配置
      const newTheme = createTheme(createMantineTheme(themeStyle));
      setCurrentTheme(newTheme);
    }
  }, [themeStyle, isMounted]);

  // 防止服务端渲染与客户端渲染不匹配
  if (!isMounted) {
    return (
      <MantineProvider theme={currentTheme} defaultColorScheme="light">
        <div style={{ visibility: 'hidden' }}>{children}</div>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={currentTheme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}
