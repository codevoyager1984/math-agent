'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BrainIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { createContext, memo, useContext, useEffect, useState } from 'react';
import { ChunkedResponse } from './chunked-response';

type ChunkedReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
};

const ChunkedReasoningContext = createContext<ChunkedReasoningContextValue | null>(null);

const useChunkedReasoning = () => {
  const context = useContext(ChunkedReasoningContext);
  if (!context) {
    throw new Error('ChunkedReasoning components must be used within ChunkedReasoning');
  }
  return context;
};

export type ChunkedReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const ChunkedReasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ChunkedReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    });

    const [hasAutoClosedRef, setHasAutoClosedRef] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.round((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosedRef) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosedRef(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosedRef]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ChunkedReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <Collapsible
          className={cn('not-prose mb-4', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ChunkedReasoningContext.Provider>
    );
  },
);

export type ChunkedReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export const ChunkedReasoningTrigger = memo(
  ({ className, children, ...props }: ChunkedReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useChunkedReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          'flex items-center gap-2 text-muted-foreground/80 text-xs hover:text-muted-foreground transition-colors',
          'py-1 px-2 rounded-md hover:bg-muted/50',
          className,
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-3.5" />
            {isStreaming || duration === 0 ? (
              <span>Thinking...</span>
            ) : (
              <span>Thought for {duration}s</span>
            )}
            <ChevronDownIcon
              className={cn(
                'size-3.5 text-muted-foreground/60 transition-transform',
                isOpen ? 'rotate-180' : 'rotate-0',
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  },
);

export type ChunkedReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

export const ChunkedReasoningContent = memo(
  ({ className, children, ...props }: ChunkedReasoningContentProps) => (
    <CollapsibleContent
      className={cn(
        'mt-3 text-xs leading-relaxed',
        'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
        'bg-muted/30 rounded-md p-3 border-l-2 border-muted-foreground/20',
        className,
      )}
      {...props}
    >
      <ChunkedResponse className="grid pl-2">{children}</ChunkedResponse>
    </CollapsibleContent>
  ),
  (prevProps, nextProps) => {
    // Only re-render if children content has changed significantly
    return prevProps.children === nextProps.children;
  },
);

ChunkedReasoning.displayName = 'ChunkedReasoning';
ChunkedReasoningTrigger.displayName = 'ChunkedReasoningTrigger';
ChunkedReasoningContent.displayName = 'ChunkedReasoningContent';
