/**
 * LaTeX 预处理工具函数
 * 用于将 LaTeX 语法转换为 KaTeX 兼容的格式
 */

/**
 * 预处理 LaTeX 内容，转换为 KaTeX 兼容格式
 * @param content 原始内容
 * @returns 处理后的内容
 */
export function preprocessLatex(content: string): string {
  if (!content) return '';
  
  return content
    // 处理 align* 环境 - 转换为 aligned (KaTeX 更好支持)
    .replace(/\\begin\{align\*\}([\s\S]*?)\\end\{align\*\}/g, '\n$$\\begin{aligned}$1\\end{aligned}$$\n')
    // 处理其他 LaTeX 环境
    .replace(/\\begin\{(equation\*?|gather\*?|multline\*?)\}/g, '\n$$\\begin{$1}')
    .replace(/\\end\{(equation\*?|gather\*?|multline\*?)\}/g, '\\end{$1}$$\n')
    // 替换 \[ \] 为 $$ $$ (块级数学公式)
    .replace(/\\\[/g, '\n$$')
    .replace(/\\\]/g, '$$\n')
    // 替换 \( \) 为 $ $ (行内数学公式)
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    // 确保块级公式前后有换行
    .replace(/([^\n])\$\$/g, '$1\n$$')
    .replace(/\$\$([^\n])/g, '$$\n$1');
}

/**
 * 检查内容是否包含知识点标记
 * @param content 内容
 * @returns 是否包含知识点标记
 */
export function hasKnowledgeTags(content: string): boolean {
  if (!content) return false;
  return /\[\[knowledge:([^:]+):([^\]]+)\]\]/g.test(content);
}

/**
 * 预处理内容：处理数学公式和知识点标记
 * @param content 原始内容
 * @returns 处理后的内容和是否包含知识点标记
 */
export function preprocessContent(content: string): {
  processedContent: string;
  hasKnowledgeTags: boolean;
} {
  if (!content) return { processedContent: '', hasKnowledgeTags: false };
  
  const hasKnowledgeTagsFlag = hasKnowledgeTags(content);
  const processedContent = preprocessLatex(content);
  
  return {
    processedContent,
    hasKnowledgeTags: hasKnowledgeTagsFlag
  };
}
