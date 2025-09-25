'use client';

import { useMemo, useRef, useEffect } from 'react';

export const LINES_PER_CHUNK = 10;

/**
 * Check if a line is part of a LaTeX math block
 */
function isInMathBlock(line: string, mathBlockState: { inBlock: boolean; blockType: string }): boolean {
  // Check for single $ math delimiters (standalone on line or with whitespace)
  const trimmedLine = line.trim();
  if (trimmedLine === '$') {
    mathBlockState.inBlock = !mathBlockState.inBlock;
    mathBlockState.blockType = mathBlockState.inBlock ? '$' : '';
    return true;
  }
  
  // Check for block math delimiters $$
  if (line.includes('$$')) {
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 === 1) {
      mathBlockState.inBlock = !mathBlockState.inBlock;
      mathBlockState.blockType = mathBlockState.inBlock ? '$$' : '';
    }
  }
  
  // Check for LaTeX \[ \] delimiters
  if (line.includes('\\[')) {
    mathBlockState.inBlock = true;
    mathBlockState.blockType = '\\[';
  }
  if (line.includes('\\]') && mathBlockState.blockType === '\\[') {
    mathBlockState.inBlock = false;
    mathBlockState.blockType = '';
  }
  
  // Check for LaTeX environments
  const beginMatch = line.match(/\\begin\{([^}]+)\}/);
  const endMatch = line.match(/\\end\{([^}]+)\}/);
  
  if (beginMatch) {
    mathBlockState.inBlock = true;
    mathBlockState.blockType = beginMatch[1];
  } else if (endMatch && mathBlockState.blockType === endMatch[1]) {
    mathBlockState.inBlock = false;
    mathBlockState.blockType = '';
  }
  
  return mathBlockState.inBlock;
}

/**
 * Split content into chunks based on line count, but preserve LaTeX math blocks
 */
export function splitContentIntoChunks(content: string, linesPerChunk: number = LINES_PER_CHUNK): string[] {
  if (!content) return [];
  
  const lines = content.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let linesInCurrentChunk = 0;
  const mathBlockState = { inBlock: false, blockType: '' };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const wasInMathBlock = mathBlockState.inBlock;
    isInMathBlock(line, mathBlockState);
    
    currentChunk.push(line);
    linesInCurrentChunk++;
    
    // Only create a new chunk if:
    // 1. We've reached the line limit
    // 2. AND we're not currently in a math block
    // 3. AND we weren't in a math block before processing this line
    const shouldCreateNewChunk = 
      linesInCurrentChunk >= linesPerChunk && 
      !mathBlockState.inBlock && 
      !wasInMathBlock;
    
    if (shouldCreateNewChunk) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      linesInCurrentChunk = 0;
    }
  }
  
  // Add the remaining chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
  
  return chunks;
}

/**
 * Hook to manage chunked content rendering
 * Only re-renders new chunks when content grows
 */
export function useChunkedContent(content: string, linesPerChunk: number = LINES_PER_CHUNK) {
  const previousChunksRef = useRef<string[]>([]);
  const previousContentLengthRef = useRef(0);
  
  const chunks = useMemo(() => {
    // Only recalculate if content has grown
    if (content.length <= previousContentLengthRef.current) {
      return previousChunksRef.current;
    }
    
    const newChunks = splitContentIntoChunks(content, linesPerChunk);
    
    // If we have previous chunks and content has grown, try to reuse them
    if (previousChunksRef.current.length > 0) {
      // Check if the existing chunks are still valid (haven't changed)
      const existingChunksStillValid = previousChunksRef.current.every((chunk, index) => {
        if (index < newChunks.length - 1) {
          // For all chunks except the last one, they should be identical
          return chunk === newChunks[index];
        }
        return true; // The last chunk can change as content grows
      });
      
      if (existingChunksStillValid) {
        // Only update if we have new complete chunks
        const lastChunkIndex = newChunks.length - 1;
        const updatedChunks = [...previousChunksRef.current];
        
        // Update the last chunk and add any new chunks
        for (let i = lastChunkIndex; i < newChunks.length; i++) {
          updatedChunks[i] = newChunks[i];
        }
        
        previousChunksRef.current = updatedChunks;
        previousContentLengthRef.current = content.length;
        return updatedChunks;
      }
    }
    
    // Fallback: use new chunks
    previousChunksRef.current = newChunks;
    previousContentLengthRef.current = content.length;
    return newChunks;
  }, [content, linesPerChunk]);
  
  return chunks;
}

/**
 * Hook to track which chunks have changed since last render
 */
export function useChunkChanges(chunks: string[]) {
  const previousChunksRef = useRef<string[]>([]);
  const changedChunksRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    const newChangedChunks = new Set<number>();
    
    // Check which chunks have changed
    chunks.forEach((chunk, index) => {
      if (previousChunksRef.current[index] !== chunk) {
        newChangedChunks.add(index);
      }
    });
    
    // If we have new chunks beyond previous length
    if (chunks.length > previousChunksRef.current.length) {
      for (let i = previousChunksRef.current.length; i < chunks.length; i++) {
        newChangedChunks.add(i);
      }
    }
    
    changedChunksRef.current = newChangedChunks;
    previousChunksRef.current = [...chunks];
  }, [chunks]);
  
  return changedChunksRef.current;
}
