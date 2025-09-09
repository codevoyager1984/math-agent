#!/usr/bin/env python3
"""
Test script to demonstrate comprehensive logging for DeepSeek document parsing
"""
import logging
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging to show all levels
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

def create_sample_document():
    """Create a sample mathematical document for testing"""
    content = """
# 微积分基础

## 1. 导数的定义

导数是微积分的基本概念之一，用于描述函数在某一点的变化率。

设函数 f(x) 在点 x₀ 的邻域内有定义，如果极限

lim(h→0) [f(x₀+h) - f(x₀)]/h

存在，则称此极限为函数 f(x) 在点 x₀ 处的导数。

### 例题1：计算 f(x) = x² 在 x = 2 处的导数

解：根据导数定义
f'(2) = lim(h→0) [(2+h)² - 2²]/h
     = lim(h→0) [4 + 4h + h² - 4]/h  
     = lim(h→0) [4h + h²]/h
     = lim(h→0) (4 + h)
     = 4

## 2. 常用导数公式

1. (x^n)' = nx^(n-1)
2. (sin x)' = cos x
3. (cos x)' = -sin x
4. (e^x)' = e^x
5. (ln x)' = 1/x

### 例题2：计算 f(x) = 3x³ - 2x² + x - 5 的导数

解：利用导数公式和线性性质
f'(x) = 3·3x² - 2·2x + 1 - 0
      = 9x² - 4x + 1
"""
    return content

async def test_document_parsing():
    """Test the document parsing with comprehensive logging"""
    print("🚀 Starting DeepSeek document parsing logging test\n")
    
    try:
        from services.document_processor import document_processor
        from services.ai_service import get_ai_service
        
        # Create sample document
        sample_text = create_sample_document()
        sample_filename = "test_calculus.md"
        
        print(f"📄 Created sample document: {sample_filename}")
        print(f"📏 Content length: {len(sample_text)} characters\n")
        
        # Test document processing
        print("🔍 Testing document text extraction...")
        file_content = sample_text.encode('utf-8')
        extracted_text = await document_processor.process_file_content(file_content, sample_filename)
        
        print(f"✅ Text extraction completed")
        print(f"📊 Extracted text length: {len(extracted_text)} characters\n")
        
        # Test AI service
        print("🤖 Testing DeepSeek knowledge point generation...")
        ai_service = get_ai_service()
        knowledge_points = await ai_service.generate_knowledge_points(extracted_text, max_points=5)
        
        print(f"✅ Knowledge point generation completed")
        print(f"📚 Generated {len(knowledge_points)} knowledge points\n")
        
        # Display results
        print("📋 Generated Knowledge Points:")
        for i, kp in enumerate(knowledge_points, 1):
            print(f"{i}. {kp.title} (Category: {kp.category})")
            print(f"   Examples: {len(kp.examples)}, Tags: {len(kp.tags)}")
        
        print(f"\n🎉 Test completed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        logging.error(f"Test execution failed: {e}", exc_info=True)

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_document_parsing())