"""
Document processing service using LangChain for various file formats
"""
import io
import os
import asyncio
from typing import List, Optional
from pathlib import Path
import aiofiles
import tempfile
import time

from langchain.schema import Document
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
    UnstructuredMarkdownLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from loguru import logger


class DocumentProcessor:
    """Document processor for various file formats"""
    
    SUPPORTED_EXTENSIONS = {
        '.pdf': 'pdf',
        '.docx': 'docx',
        '.doc': 'docx',
        '.txt': 'txt',
        '.md': 'markdown',
        '.markdown': 'markdown'
    }
    
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=4000,
            chunk_overlap=200,
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " "]
        )
    
    def get_file_type(self, filename: str) -> Optional[str]:
        """Get file type based on extension"""
        ext = Path(filename).suffix.lower()
        return self.SUPPORTED_EXTENSIONS.get(ext)
    
    def is_supported_file(self, filename: str) -> bool:
        """Check if file type is supported"""
        return self.get_file_type(filename) is not None
    
    def process_pdf(self, file_path: str) -> List[Document]:
        """Process PDF file"""
        try:
            loader = PyPDFLoader(file_path)
            documents = loader.load()
            return documents
        except Exception as e:
            logger.error(f"Error processing PDF {file_path}: {e}")
            raise
    
    def process_docx(self, file_path: str) -> List[Document]:
        """Process DOCX file"""
        try:
            loader = Docx2txtLoader(file_path)
            documents = loader.load()
            return documents
        except Exception as e:
            logger.error(f"Error processing DOCX {file_path}: {e}")
            raise
    
    def process_text(self, file_path: str) -> List[Document]:
        """Process text file"""
        try:
            loader = TextLoader(file_path, encoding='utf-8')
            documents = loader.load()
            return documents
        except Exception as e:
            logger.error(f"Error processing text file {file_path}: {e}")
            raise
    
    def process_markdown(self, file_path: str) -> List[Document]:
        """Process markdown file"""
        try:
            loader = UnstructuredMarkdownLoader(file_path)
            documents = loader.load()
            return documents
        except Exception as e:
            logger.error(f"Error processing markdown file {file_path}: {e}")
            raise
    
    async def process_file_content(self, file_content: bytes, filename: str) -> str:
        """Process file content and extract text"""
        logger.debug(f"Starting file content processing for: {filename}")
        logger.debug(f"File content size: {len(file_content)} bytes")
        
        try:
            file_type = self.get_file_type(filename)
            if not file_type:
                logger.error(f"Unsupported file type: {filename}")
                raise ValueError(f"Unsupported file type: {filename}")
            
            logger.debug(f"File type detected: {file_type}")
            
            # Create temporary file asynchronously
            temp_start = time.time()
            temp_file_fd, temp_file_path = tempfile.mkstemp(suffix=Path(filename).suffix)
            try:
                # Write file content asynchronously
                async with aiofiles.open(temp_file_path, 'wb') as temp_file:
                    await temp_file.write(file_content)
                os.close(temp_file_fd)  # Close the file descriptor
                
                temp_time = time.time() - temp_start
                logger.debug(f"Temporary file created in {temp_time:.3f}s: {temp_file_path}")
                
                try:
                    # Process based on file type (run in thread pool to avoid blocking)
                    process_start = time.time()
                    logger.info(f"Processing {file_type.upper()} file: {filename}")
                    
                    # Run the synchronous document processing in a thread pool
                    loop = asyncio.get_event_loop()
                    if file_type == 'pdf':
                        documents = await loop.run_in_executor(None, self.process_pdf, temp_file_path)
                    elif file_type == 'docx':
                        documents = await loop.run_in_executor(None, self.process_docx, temp_file_path)
                    elif file_type == 'txt':
                        documents = await loop.run_in_executor(None, self.process_text, temp_file_path)
                    elif file_type == 'markdown':
                        documents = await loop.run_in_executor(None, self.process_markdown, temp_file_path)
                    else:
                        logger.error(f"Unsupported file type: {file_type}")
                        raise ValueError(f"Unsupported file type: {file_type}")
                    
                    process_time = time.time() - process_start
                    logger.info(f"Document processing completed in {process_time:.3f}s")
                    logger.debug(f"Extracted {len(documents)} document chunks")
                    
                    # Combine all document content
                    combine_start = time.time()
                    combined_text = "\n\n".join([doc.page_content for doc in documents])
                    combine_time = time.time() - combine_start
                    
                    logger.debug(f"Document chunks combined in {combine_time:.3f}s")
                    logger.debug(f"Raw combined text length: {len(combined_text)} characters")
                    
                    # Clean and normalize text (run in thread pool for CPU-intensive task)
                    clean_start = time.time()
                    cleaned_text = await loop.run_in_executor(None, self.clean_text, combined_text)
                    clean_time = time.time() - clean_start
                    
                    logger.debug(f"Text cleaning completed in {clean_time:.3f}s")
                    logger.info(f"Final extracted text length: {len(cleaned_text)} characters")
                    
                    # Log text preview
                    if cleaned_text:
                        preview = cleaned_text[:200].replace('\n', '\\n')
                        logger.debug(f"Text preview: {preview}...")
                    
                    return cleaned_text
                    
                finally:
                    # Clean up temporary file asynchronously
                    try:
                        cleanup_start = time.time()
                        await loop.run_in_executor(None, os.unlink, temp_file_path)
                        cleanup_time = time.time() - cleanup_start
                        logger.debug(f"Temporary file cleanup completed in {cleanup_time:.3f}s")
                    except Exception as e:
                        logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")
                        
            except Exception as e:
                # Ensure file descriptor is closed in case of early failure
                try:
                    os.close(temp_file_fd)
                except:
                    pass
                raise
        
        except Exception as e:
            logger.error(f"Error processing file {filename}: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            raise
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize extracted text"""
        # Remove excessive whitespace
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            if line:  # Skip empty lines
                cleaned_lines.append(line)
        
        # Join lines with double newlines for proper separation
        cleaned_text = '\n\n'.join(cleaned_lines)
        
        # Remove multiple consecutive newlines
        import re
        cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
        
        return cleaned_text
    
    def split_text_into_chunks(self, text: str) -> List[str]:
        """Split text into manageable chunks for AI processing"""
        # Create documents for splitting
        documents = [Document(page_content=text)]
        
        # Split into chunks
        chunks = self.text_splitter.split_documents(documents)
        
        return [chunk.page_content for chunk in chunks]


# Global instance
document_processor = DocumentProcessor()