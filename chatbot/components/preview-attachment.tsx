import type { Attachment } from '@/lib/types';
import { Loader } from './elements/loader';
import { Response } from './elements/response';
import { CrossSmallIcon, } from './icons';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
  onEdit,
  onOcrTextChange,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
  onOcrTextChange?: (newText: string) => void;
}) => {
  const { name, url, contentType, ocrText, ocrLoading } = attachment;

  // Debug logging - temporarily enabled to track OCR states
  console.log('PreviewAttachment Debug:', {
    name,
    isUploading,
    contentType,
    ocrText,
    ocrLoading,
    hasOcrText: !!ocrText,
    ocrTextLength: ocrText?.length,
    ocrTextUndefined: ocrText === undefined
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showOcrPreview, setShowOcrPreview] = useState(false);
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [editedOcrText, setEditedOcrText] = useState(ocrText || '');
  const [editPreviewMode, setEditPreviewMode] = useState<'edit' | 'preview'>('edit');
  const { t } = useTranslation();

  const handleImageClick = () => {
    if (contentType?.startsWith('image') && url && !isUploading && !ocrLoading) {
      setShowPreview(true);
    }
  };

  const handleSaveOcrText = () => {
    if (onOcrTextChange) {
      onOcrTextChange(editedOcrText);
    }
    setIsEditingOcr(false);
  };

  const handleCancelOcrEdit = () => {
    setEditedOcrText(ocrText || '');
    setIsEditingOcr(false);
  };

  // Update edited text when ocrText changes
  useEffect(() => {
    setEditedOcrText(ocrText || '');
  }, [ocrText]);

  // Handle ESC key to close preview
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showPreview) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showPreview]);

  return (
    <div className="group relative flex flex-col">
      <div data-testid="input-attachment-preview" className="relative size-16 rounded-lg overflow-hidden bg-muted border">
        {contentType?.startsWith('image') ? (
          <div
            className={`relative size-full group/image ${
              isUploading || ocrLoading ? 'cursor-default' : 'cursor-pointer'
            }`}
            onClick={handleImageClick}
            title={
              isUploading
                ? '上传中，请稍候...'
                : ocrLoading
                ? '正在识别文字，请稍候...'
                : ocrText !== undefined
                ? '点击查看大图'
                : '等待处理，点击预览图片'
            }
          >
            <img
              src={url}
              alt={name ?? t('attachments.imageAttachment')}
              className="size-full object-cover hover:opacity-80 transition-opacity"
            />
            {/* Hover overlay with magnifier icon */}
            {!isUploading && !ocrLoading && (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <div className="size-6 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="size-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="size-full flex items-center justify-center text-xs text-muted-foreground">
            File
          </div>
        )}

        {(isUploading || ocrLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader size={16} />
          </div>
        )}

        {onRemove && !isUploading && (
          <Button
            type="button"
            onClick={onRemove}
            size="sm"
            variant="destructive"
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity size-4 p-0 rounded-full"
          >
            <CrossSmallIcon size={8} />
          </Button>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[10px] px-1 py-0.5 truncate">
          {(() => {
            if (isUploading) {
              return '上传中...';
            }

            if (contentType?.startsWith('image')) {
              if (ocrLoading === true) {
                return '识别中...';
              }

              if (ocrLoading === false || ocrText !== undefined) {
                return ocrText && ocrText.trim() ? '识别完成' : '无文字内容';
              }

              // OCR hasn't started yet for image files
              return '等待处理...';
            }

            // Non-image files
            return '文件预览';
          })()}
        </div>
      </div>
      
      {/* OCR Result Display */}
      {contentType?.startsWith('image') && ocrText && (
        <div className="mt-2 max-w-xs">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-muted-foreground">识别结果:</div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowOcrPreview(!showOcrPreview)}
                className="h-5 px-1 text-xs"
                title={showOcrPreview ? "折叠" : "展开预览"}
              >
                {showOcrPreview ? "折叠" : "展开"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingOcr(true)}
                className="h-5 px-1 text-xs"
                title="编辑文本"
              >
                编辑
              </Button>
            </div>
          </div>
          
          {showOcrPreview ? (
            <div className="text-xs bg-muted rounded p-2 relative">
              <div className="max-h-32 overflow-y-auto">
                <Response key={`expanded-${ocrText?.slice(0, 20)}`} className="text-xs">{ocrText}</Response>
              </div>
            </div>
          ) : (
            <div className="text-xs bg-muted rounded p-2 relative h-16">
              <div className="h-12 overflow-hidden">
                <div className="text-xs leading-4 h-12">
                  {/* Use plain text in collapsed view to avoid complex rendering issues */}
                  <div className="line-clamp-3" style={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '16px',
                    maxHeight: '48px'
                  }}>
                    {ocrText}
                  </div>
                </div>
              </div>
              {/* Fade out gradient at the bottom */}
              <div className="absolute bottom-2 left-2 right-2 h-3 bg-gradient-to-t from-muted to-transparent pointer-events-none"></div>
            </div>
          )}
        </div>
      )}
      
      {/* {contentType?.startsWith('image') && ocrLoading && (
        <div className="mt-2 max-w-xs">
          <div className="text-xs text-muted-foreground">正在识别图片文字...</div>
        </div>
      )} */}

      {/* OCR Edit Modal */}
      <AnimatePresence>
        {isEditingOcr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10003] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={handleCancelOcrEdit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-2xl m-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <div className="flex flex-col">
                  <h3 className="text-lg font-semibold">编辑识别文本</h3>
                  <div className="text-sm text-muted-foreground">
                    修改OCR识别的文本内容，支持Markdown和LaTeX格式
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelOcrEdit}
                  className="size-8 p-0"
                  title="取消编辑"
                >
                  <CrossSmallIcon size={16} />
                </Button>
              </div>

              {/* Mode Switcher */}
              <div className="flex border-b dark:border-gray-700">
                <Button
                  type="button"
                  variant="ghost"
                  className={`flex-1 rounded-none border-b-2 ${
                    editPreviewMode === 'edit' 
                      ? 'border-primary bg-muted' 
                      : 'border-transparent'
                  }`}
                  onClick={() => setEditPreviewMode('edit')}
                >
                  编辑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className={`flex-1 rounded-none border-b-2 ${
                    editPreviewMode === 'preview' 
                      ? 'border-primary bg-muted' 
                      : 'border-transparent'
                  }`}
                  onClick={() => setEditPreviewMode('preview')}
                >
                  预览
                </Button>
              </div>

              {/* Content */}
              <div className="p-4 min-h-[300px]">
                {editPreviewMode === 'edit' ? (
                  <Textarea
                    value={editedOcrText}
                    onChange={(e) => setEditedOcrText(e.target.value)}
                    placeholder="请输入文本内容...支持Markdown和LaTeX格式，例如：$x^2 + y^2 = z^2$"
                    className="min-h-[250px] resize-none"
                    autoFocus
                  />
                ) : (
                  <div className="min-h-[250px] border rounded p-3 bg-background overflow-y-auto">
                    {editedOcrText.trim() ? (
                      <Response>{editedOcrText}</Response>
                    ) : (
                      <div className="text-muted-foreground text-center pt-20">
                        暂无内容可预览
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-4 border-t dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelOcrEdit}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveOcrText}
                  disabled={editedOcrText === ocrText}
                >
                  保存
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative max-w-[90vw] max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                <div className="flex flex-col">
                  <h3 className="text-lg font-semibold">图片预览</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{contentType}</span>
                    <span>•</span>
                    <span>按 ESC 键关闭</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="size-8 p-0"
                  title="关闭预览 (ESC)"
                >
                  <CrossSmallIcon size={16} />
                </Button>
              </div>

              {/* Image */}
              <div className="flex items-center justify-center p-4">
                <img
                  src={url}
                  alt={name ?? t('attachments.preview')}
                  className="max-w-full max-h-[70vh] object-contain"
                  style={{ minHeight: '200px' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const errorDiv = target.nextElementSibling || document.createElement('div');
                    if (!target.nextElementSibling) {
                      errorDiv.className = 'flex items-center justify-center h-48 text-muted-foreground';
                      errorDiv.textContent = '图片加载失败';
                      target.parentNode?.appendChild(errorDiv);
                    }
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
