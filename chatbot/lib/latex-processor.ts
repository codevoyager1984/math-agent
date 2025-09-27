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
  
  // 特殊处理：如果chunk只包含 \[ 或 \]，不要转换
  const trimmedContent = content.trim();
  if (trimmedContent === '\\[' || trimmedContent === '\\]') {
    return content;
  }
  
  // 特殊处理：如果chunk以 \[ 开头但没有 \]，不要转换
  if (content.trim().startsWith('\\[') && !content.includes('\\]')) {
    return content;
  }
  
  // 特殊处理：如果chunk以 \] 结尾但没有 \[，不要转换
  if (content.trim().endsWith('\\]') && !content.includes('\\[')) {
    return content;
  }
  
  // 特殊处理：如果chunk只包含 \]，不要转换
  if (content.trim() === '\\]') {
    return content;
  }
  
  const result = content
    // 首先处理 \[ \] 为完整的 $$ $$ 格式 - 使用更宽松的匹配
    .replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
      // 移除内容中的多余换行，但保留必要的空格
      const processedContent = content
        .replace(/^\s*\n+/, '') // 移除开头的换行
        .replace(/\n+\s*$/, '') // 移除结尾的换行
        .replace(/\n\s*\n/g, ' ') // 将多个换行替换为单个空格
        .replace(/\n/g, ' '); // 将剩余的换行替换为空格
      return `\n$$${processedContent}$$\n`;
    })
    // 处理 align* 环境 - 转换为 aligned (KaTeX 更好支持)
    .replace(/\\begin\{align\*\}([\s\S]*?)\\end\{align\*\}/g, '\n$$\\begin{aligned}$1\\end{aligned}$$\n')
    // 处理其他 LaTeX 环境
    .replace(/\\begin\{(equation\*?|gather\*?|multline\*?)\}/g, '\n$$\\begin{$1}')
    .replace(/\\end\{(equation\*?|gather\*?|multline\*?)\}/g, '\\end{$1}$$\n')
    // 处理单独的 \[ 和 \] 标记（如果上面没有匹配到）
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    // 替换 \( \) 为 $ $ (行内数学公式)
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$')
    // 确保块级公式前后有换行
    .replace(/([^\n])\$\$/g, '$1\n$$')
    .replace(/\$\$([^\n])/g, '$$\n$1')
    // 处理答案选项格式 - 确保选择题选项前有换行
    .replace(/([^\n\s])\s*([ABCD]\.\s*)/g, '$1\n$2')
    // 处理连续的选择题选项，确保它们之间有换行
    .replace(/([ABCD]\.\s*[^\n]*?)\s+([ABCD]\.\s*)/g, '$1\n$2')
    // 额外处理：确保选项和前面的内容之间有换行
    .replace(/([，。！？])\s*([ABCD]\.\s*)/g, '$1\n$2');
  return result;
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
