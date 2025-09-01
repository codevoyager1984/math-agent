import type { Attachment } from '@/lib/types';
import { Loader } from './elements/loader';
import { CrossSmallIcon, } from './icons';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
  onEdit,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
  onEdit?: () => void;
}) => {
  const { name, url, contentType, ocrText, ocrLoading } = attachment;
  const [showPreview, setShowPreview] = useState(false);

  const handleImageClick = () => {
    if (contentType?.startsWith('image') && url && !isUploading) {
      setShowPreview(true);
    }
  };

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
      <div data-testid="input-attachment-preview" className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted border">
        {contentType?.startsWith('image') ? (
          <div 
            className="relative w-full h-full group/image cursor-pointer"
            onClick={handleImageClick}
            title="点击查看大图"
          >
            <img
              src={url}
              alt={name ?? 'An image attachment'}
              className="w-full h-full object-cover hover:opacity-80 transition-opacity"
            />
            {/* Hover overlay with magnifier icon */}
            {!isUploading && !ocrLoading && (
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
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
            onClick={onRemove}
            size="sm"
            variant="destructive"
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity size-4 p-0 rounded-full"
          >
            <CrossSmallIcon size={8} />
          </Button>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-[10px] px-1 py-0.5 truncate">
          {name}
        </div>
      </div>
      
      {/* OCR Result Display */}
      {contentType?.startsWith('image') && ocrText && (
        <div className="mt-2 max-w-xs">
          <div className="text-xs text-muted-foreground mb-1">识别结果:</div>
          <div className="text-xs bg-muted rounded p-2 max-h-20 overflow-y-auto">
            {ocrText}
          </div>
        </div>
      )}
      
      {contentType?.startsWith('image') && ocrLoading && (
        <div className="mt-2 max-w-xs">
          <div className="text-xs text-muted-foreground">正在识别图片文字...</div>
        </div>
      )}

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
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
                  <h3 className="text-lg font-semibold">{name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{contentType}</span>
                    <span>•</span>
                    <span>按 ESC 键关闭</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="h-8 w-8 p-0"
                  title="关闭预览 (ESC)"
                >
                  <CrossSmallIcon size={16} />
                </Button>
              </div>

              {/* Image */}
              <div className="flex items-center justify-center p-4">
                <img
                  src={url}
                  alt={name ?? 'Preview'}
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

              {/* OCR Results */}
              {ocrText && (
                <div className="p-4 border-t dark:border-gray-700 bg-muted/50">
                  <h4 className="text-sm font-medium mb-2">识别结果:</h4>
                  <div className="text-sm bg-background rounded p-3 max-h-40 overflow-y-auto">
                    {ocrText}
                  </div>
                </div>
              )}

              {ocrLoading && (
                <div className="p-4 border-t dark:border-gray-700 bg-muted/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader size={16} />
                    <span>正在识别图片文字...</span>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
