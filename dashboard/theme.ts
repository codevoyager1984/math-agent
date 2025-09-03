'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActionIcon, Button, createTheme, Loader, MantineThemeOverride } from '@mantine/core';

// 主题风格类型 - 简化为主要的几种风格
export type ThemeStyle = 'fellou' | 'light' | 'dark';

// 创建主题风格状态管理
export const useThemeStyle = create<{
  style: ThemeStyle;
  setStyle: (style: ThemeStyle) => void;
}>()(
  persist(
    (set) => ({
      style: 'fellou', // 默认使用 Fellou 官网主题
      setStyle: (style) => set({ style }),
    }),
    {
      name: 'f.theme_style', // localStorage 中的 key 名称
    }
  )
);

// 简化的主题风格选项
export const themeStyles: { value: ThemeStyle; label: string }[] = [
  { value: 'fellou', label: 'Fellou 主题' },
  { value: 'light', label: '浅色主题' },
  { value: 'dark', label: '深色主题' },
];

// 获取当前主题样式
const getCurrentThemeStyle = (): ThemeStyle => {
  const defaultTheme: ThemeStyle = 'fellou';

  if (typeof window === 'undefined') {
    return defaultTheme;
  }

  try {
    const savedTheme = localStorage.getItem('f.theme_style');
    if (savedTheme) {
      const parsedTheme = JSON.parse(savedTheme);
      if (parsedTheme.state && parsedTheme.state.style) {
        return parsedTheme.state.style;
      }
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error);
  }

  return defaultTheme;
};

// 创建基础主题配置
export const createMantineTheme = (
  themeStyle?: ThemeStyle
): MantineThemeOverride => {
  const currentStyle = themeStyle || getCurrentThemeStyle();
  
  // 使用固定的默认颜色
  const primaryColor = '#8B5CF6';
  const primaryColorLight = '#A78BFA';
  const primaryColorDark = '#6D28D9';
  const secondaryColor = '#6366F1';
  const gradientFrom = '#6366f1';
  const gradientTo = '#8b5cf6';
  const gradientDeg = 135;

  return {
    primaryColor: 'fellou',
    defaultRadius: 'lg',
    focusRing: 'always',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    headings: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' },
    components: {
      ActionIcon: ActionIcon.extend({
        defaultProps: {
          variant: 'gradient',
          gradient: { from: gradientFrom, to: gradientTo, deg: gradientDeg },
        },
      }),
      Loader: Loader.extend({
        defaultProps: {
          type: 'dots',
          color: 'fellou',
        },
      }),
      Button: Button.extend({
        defaultProps: {
          variant: 'gradient',
          gradient: { from: gradientFrom, to: gradientTo, deg: gradientDeg },
        },
      }),
    },
    colors: {
      // 深色主题配色
      dark: [
        '#C1C2C5',
        '#A6A7AB',
        '#909296',
        '#5C5F66',
        '#373A40',
        '#2C2E33',
        '#25262B',
        '#1A1B1E',
        '#141517',
        '#101113',
      ],
      // Fellou 官网主题色 - 紫色渐变系列
      fellou: [
        '#F5F3FF', // 最浅的紫色
        '#EDE9FE', // 浅紫色
        '#DDD6FE', // 
        '#C4B5FD', // 
        '#A78BFA', // 
        '#8B5CF6', // 主要紫色
        '#7C3AED', // 
        '#6D28D9', // 
        '#5B21B6', // 
        '#4C1D95', // 最深的紫色
      ],
      // 浅色主题的灰色配色
      light: [
        '#F8FAFC',
        '#F1F5F9',
        '#E2E8F0',
        '#CBD5E1',
        '#94A3B8',
        '#64748B',
        '#475569',
        '#334155',
        '#1E293B',
        '#0F172A',
      ],
    },
    other: {
      boxShadow: '0 4px 24px rgba(139, 92, 246, 0.12)',
      glassmorphism: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
    },
  };
};

// 导出默认主题配置
export const theme = createTheme(createMantineTheme());
