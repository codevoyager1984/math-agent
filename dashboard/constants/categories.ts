/**
 * 数学知识点分类常量定义
 * 用于整个应用中的分类选择和展示
 */

export interface CategoryOption {
  value: string;
  label: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'sequence', label: '数列' },
  { value: 'algebra', label: '代数' },
  { value: 'geometry', label: '几何' },
  { value: 'calculus', label: '微积分' },
  { value: 'statistics', label: '概率统计' },
  { value: 'linear-algebra', label: '线性代数' },
  { value: 'discrete-math', label: '离散数学' },
  { value: 'number-theory', label: '数论' },
  { value: 'general', label: '通用' },
];

/**
 * 获取所有分类选项（包含"全部分类"选项）
 * 用于搜索筛选等需要"全部"选项的场景
 */
export function getCategoryOptionsWithAll(): CategoryOption[] {
  return [
    { value: 'all', label: '全部分类' },
    ...CATEGORY_OPTIONS,
  ];
}

/**
 * 根据分类值获取分类标签
 */
export function getCategoryLabel(value: string): string {
  const category = CATEGORY_OPTIONS.find(cat => cat.value === value);
  return category?.label || value;
}

/**
 * 检查分类值是否有效
 */
export function isValidCategory(value: string): boolean {
  return CATEGORY_OPTIONS.some(cat => cat.value === value);
}