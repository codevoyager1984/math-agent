'use client';

import { memo, useState } from 'react';
import { SearchIcon, CodeIcon, EyeIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CodeBlock } from './elements/code-block';
import { cn } from '@/lib/utils';

interface KnowledgeSearchInputProps {
  input: {
    query: string;
    category?: string;
  };
}

export const KnowledgeSearchInput = memo(function KnowledgeSearchInput({
  input,
}: KnowledgeSearchInputProps) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          搜索参数
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowJson(!showJson)}
          className="h-6 px-2 text-xs"
        >
          {showJson ? (
            <>
              <EyeIcon className="size-3 mr-1" />
              查看参数
            </>
          ) : (
            <>
              <CodeIcon className="size-3 mr-1" />
              JSON模式
            </>
          )}
        </Button>
      </div>

      {showJson ? (
        <div className="rounded-md bg-muted/50">
          <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
            <SearchIcon className="size-4 text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                查询关键词
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1 font-mono bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                "{input.query}"
              </div>
            </div>
          </div>
          
          {input.category && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
              <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                分类筛选
              </Badge>
              <span className="text-sm text-amber-700 dark:text-amber-300 font-mono">
                {input.category}
              </span>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900/50 p-2 rounded border">
            <div className="flex items-center gap-1">
              <span className="font-medium">搜索范围:</span>
              <span>数学知识库</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="font-medium">返回结果:</span>
              <span>最相关的3个知识点</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
