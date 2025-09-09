"""
AI service for generating knowledge points using DeepSeek API
"""
import json
import time
import uuid
from typing import List, Optional
import aiohttp
import asyncio
from pydantic import BaseModel, Field
from config import settings
from loguru import logger


class ExampleData(BaseModel):
    """Example data structure for knowledge points"""
    question: str
    solution: str
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")


class KnowledgePointData(BaseModel):
    """Knowledge point data structure"""
    title: str
    description: str
    category: str = "general"
    examples: List[ExampleData] = []
    tags: List[str] = []


class AIService:
    """AI service for knowledge point generation using DeepSeek"""
    
    def __init__(self, api_key: str, api_base: str = "https://api.deepseek.com"):
        self.api_key = api_key
        self.api_base = api_base.rstrip('/')
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
    
    async def generate_knowledge_points(self, text: str, max_points: int = 10) -> List[KnowledgePointData]:
        """Generate knowledge points from text using DeepSeek"""
        # Generate request ID for tracking
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        logger.info(f"[{request_id}] Starting knowledge point generation")
        logger.info(f"[{request_id}] Input text length: {len(text)} characters")
        logger.info(f"[{request_id}] Max knowledge points: {max_points}")
        
        try:
            # Prepare the prompt for knowledge point extraction
            logger.debug(f"[{request_id}] Creating extraction prompt")
            prompt_start = time.time()
            prompt = self._create_extraction_prompt(text, max_points)
            prompt_time = time.time() - prompt_start
            logger.debug(f"[{request_id}] Prompt created in {prompt_time:.3f}s (length: {len(prompt)} chars)")
            
            # Call DeepSeek API
            logger.info(f"[{request_id}] Calling DeepSeek API")
            api_start = time.time()
            response = await self._call_deepseek_api(prompt, request_id)
            api_time = time.time() - api_start
            logger.info(f"[{request_id}] DeepSeek API call completed in {api_time:.3f}s")
            
            # Parse the response
            logger.debug(f"[{request_id}] Parsing AI response")
            parse_start = time.time()
            knowledge_points = self._parse_ai_response(response, request_id)
            parse_time = time.time() - parse_start
            logger.debug(f"[{request_id}] Response parsed in {parse_time:.3f}s")
            
            total_time = time.time() - start_time
            logger.info(f"[{request_id}] Knowledge point generation completed successfully")
            logger.info(f"[{request_id}] Generated {len(knowledge_points)} knowledge points in {total_time:.3f}s")
            logger.info(f"[{request_id}] Timing breakdown - Prompt: {prompt_time:.3f}s, API: {api_time:.3f}s, Parse: {parse_time:.3f}s")
            
            return knowledge_points
            
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Error generating knowledge points after {total_time:.3f}s: {e}")
            logger.error(f"[{request_id}] Exception type: {type(e).__name__}")
            raise
    
    def _create_extraction_prompt(self, text: str, max_points: int) -> str:
        """Create a structured prompt for knowledge point extraction"""
        prompt = f"""
你是一个数学知识专家，需要从给定的文档中提取数学知识点。

请仔细分析以下文档内容，提取出最多 {max_points} 个有价值的数学知识点。

对于每个知识点，请按以下JSON格式输出：
{{
  "knowledge_points": [
    {{
      "title": "知识点标题（简洁明了）",
      "description": "详细描述该知识点的概念、定义和应用场景",
      "category": "分类（如：代数、几何、微积分、概率统计、线性代数等）",
      "examples": [
        {{
          "question": "具体的数学题目或例子",
          "solution": "详细的解题步骤和答案",
          "difficulty": "easy|medium|hard"
        }}
      ],
      "tags": ["相关标签1", "相关标签2", "相关标签3"]
    }}
  ]
}}

要求：
1. 每个知识点必须是独立且有意义的数学概念
2. 描述要准确、详细，包含定义和应用
3. 至少为每个知识点提供1-3个例题
4. 例题要有完整的解题步骤
5. 标签要准确反映知识点的特征
6. 分类要规范（使用标准数学分类）
7. 输出必须是有效的JSON格式

文档内容：
{text}

请直接输出JSON，不要包含其他文字说明：
"""
        return prompt
    
    async def _call_deepseek_api(self, prompt: str, request_id: str) -> str:
        """Call DeepSeek API to generate content"""
        url = f"{self.api_base}/v1/chat/completions"
        
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 8000,
            "temperature": 0.3,
            "stream": False
        }
        
        # Log request details (without sensitive content)
        logger.info(f"[{request_id}] DeepSeek API request - Model: {payload['model']}, Max tokens: {payload['max_tokens']}, Temperature: {payload['temperature']}")
        logger.debug(f"[{request_id}] Request URL: {url}")
        logger.debug(f"[{request_id}] Prompt length: {len(prompt)} characters")
        logger.debug(f"[{request_id}] Request payload size: {len(str(payload))} bytes")
        
        try:
            request_start = time.time()
            timeout = aiohttp.ClientTimeout(total=600)
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, headers=self.headers, json=payload) as response:
                    request_time = time.time() - request_start
                    
                    logger.info(f"[{request_id}] HTTP request completed in {request_time:.3f}s")
                    logger.debug(f"[{request_id}] Response status code: {response.status}")
                    logger.debug(f"[{request_id}] Response headers: {dict(response.headers)}")
                    
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"[{request_id}] HTTP error {response.status}: {error_text[:500]}")
                        raise Exception(f"DeepSeek API returned status {response.status}: {error_text[:200]}")
                    
                    result = await response.json()
            
            # Log response details
            logger.debug(f"[{request_id}] Response JSON keys: {list(result.keys())}")
            
            if "choices" not in result or len(result["choices"]) == 0:
                logger.error(f"[{request_id}] Invalid API response: no choices found")
                logger.error(f"[{request_id}] Response: {result}")
                raise Exception("No response from DeepSeek API")
            
            # Extract usage information if available
            if "usage" in result:
                usage = result["usage"]
                logger.info(f"[{request_id}] Token usage - Prompt: {usage.get('prompt_tokens', 'N/A')}, "
                           f"Completion: {usage.get('completion_tokens', 'N/A')}, "
                           f"Total: {usage.get('total_tokens', 'N/A')}")
            
            content = result["choices"][0]["message"]["content"]
            logger.info(f"[{request_id}] DeepSeek response received - Content length: {len(content)} characters")
            logger.debug(f"[{request_id}] Response content preview: {content[:200]}...")
            
            return content.strip()
            
        except aiohttp.ClientError as e:
            logger.error(f"[{request_id}] DeepSeek API request failed: {e}")
            logger.error(f"[{request_id}] Request URL: {url}")
            raise Exception(f"DeepSeek API request failed: {str(e)}")
        except asyncio.TimeoutError as e:
            logger.error(f"[{request_id}] DeepSeek API request timeout: {e}")
            raise Exception(f"DeepSeek API request timeout: {str(e)}")
        except json.JSONDecodeError as e:
            logger.error(f"[{request_id}] Failed to decode JSON response: {e}")
            raise Exception(f"Invalid JSON response from DeepSeek API: {str(e)}")
        except Exception as e:
            logger.error(f"[{request_id}] Error calling DeepSeek API: {e}")
            raise
    
    def _parse_ai_response(self, response: str, request_id: str) -> List[KnowledgePointData]:
        """Parse AI response and convert to knowledge point objects"""
        logger.debug(f"[{request_id}] Starting response parsing")
        logger.debug(f"[{request_id}] Raw response length: {len(response)} characters")
        
        try:
            # Clean the response - remove any non-JSON content
            response = response.strip()
            logger.debug(f"[{request_id}] Response after stripping: {len(response)} characters")
            
            # Find JSON content
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                logger.error(f"[{request_id}] No JSON found in response")
                logger.error(f"[{request_id}] Response preview: {response[:500]}...")
                raise ValueError("No JSON found in response")
            
            json_content = response[start_idx:end_idx]
            logger.debug(f"[{request_id}] Extracted JSON content length: {len(json_content)} characters")
            logger.debug(f"[{request_id}] JSON content preview: {json_content[:200]}...")
            
            # Parse JSON
            logger.debug(f"[{request_id}] Attempting to parse JSON")
            parsed_data = json.loads(json_content)
            logger.info(f"[{request_id}] Successfully parsed JSON response")
            
            # Validate structure
            if "knowledge_points" not in parsed_data:
                logger.error(f"[{request_id}] Invalid response format: missing 'knowledge_points' key")
                logger.error(f"[{request_id}] Available keys: {list(parsed_data.keys())}")
                raise ValueError("Invalid response format: missing 'knowledge_points'")
            
            raw_knowledge_points = parsed_data["knowledge_points"]
            logger.info(f"[{request_id}] Found {len(raw_knowledge_points)} raw knowledge points to process")
            
            knowledge_points = []
            skipped_examples = 0
            skipped_points = 0
            
            for i, kp_data in enumerate(raw_knowledge_points):
                logger.debug(f"[{request_id}] Processing knowledge point {i+1}/{len(raw_knowledge_points)}")
                
                # Validate and create examples
                examples = []
                raw_examples = kp_data.get("examples", [])
                logger.debug(f"[{request_id}] KP {i+1} has {len(raw_examples)} raw examples")
                
                for j, ex_data in enumerate(raw_examples):
                    try:
                        example = ExampleData(
                            question=ex_data.get("question", ""),
                            solution=ex_data.get("solution", ""),
                            difficulty=ex_data.get("difficulty", "medium")
                        )
                        examples.append(example)
                        logger.debug(f"[{request_id}] KP {i+1} example {j+1} validated successfully")
                    except Exception as e:
                        skipped_examples += 1
                        logger.warning(f"[{request_id}] Skipping invalid example {j+1} in KP {i+1}: {e}")
                        logger.debug(f"[{request_id}] Invalid example data: {ex_data}")
                        continue
                
                # Create knowledge point
                try:
                    title = kp_data.get("title", "未命名知识点")
                    description = kp_data.get("description", "")
                    category = kp_data.get("category", "general")
                    tags = kp_data.get("tags", [])
                    
                    logger.debug(f"[{request_id}] KP {i+1} - Title: '{title}', Category: '{category}', Examples: {len(examples)}, Tags: {len(tags)}")
                    
                    kp = KnowledgePointData(
                        title=title,
                        description=description,
                        category=category,
                        examples=examples,
                        tags=tags
                    )
                    knowledge_points.append(kp)
                    logger.debug(f"[{request_id}] KP {i+1} created successfully")
                    
                except Exception as e:
                    skipped_points += 1
                    logger.warning(f"[{request_id}] Skipping invalid knowledge point {i+1}: {e}")
                    logger.debug(f"[{request_id}] Invalid KP data: {kp_data}")
                    continue
            
            logger.info(f"[{request_id}] Response parsing completed successfully")
            logger.info(f"[{request_id}] Successfully created {len(knowledge_points)} knowledge points")
            
            if skipped_points > 0:
                logger.warning(f"[{request_id}] Skipped {skipped_points} invalid knowledge points")
            if skipped_examples > 0:
                logger.warning(f"[{request_id}] Skipped {skipped_examples} invalid examples")
            
            # Log summary statistics
            total_examples = sum(len(kp.examples) for kp in knowledge_points)
            categories = [kp.category for kp in knowledge_points]
            unique_categories = set(categories)
            
            logger.info(f"[{request_id}] Final statistics - Knowledge points: {len(knowledge_points)}, "
                       f"Total examples: {total_examples}, Categories: {len(unique_categories)} ({', '.join(unique_categories)})")
            
            return knowledge_points
            
        except json.JSONDecodeError as e:
            logger.error(f"[{request_id}] Failed to parse JSON response: {e}")
            logger.error(f"[{request_id}] JSON decode error line: {e.lineno}, column: {e.colno}")
            logger.error(f"[{request_id}] Response content: {response}")
            raise ValueError(f"Invalid JSON response from AI: {str(e)}")
        except Exception as e:
            logger.error(f"[{request_id}] Error parsing AI response: {e}")
            logger.error(f"[{request_id}] Exception type: {type(e).__name__}")
            raise


def create_ai_service() -> AIService:
    """Create AI service instance with configuration"""
    
    api_key = settings.DEEPSEEK_API_KEY
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY environment variable is required")
    
    return AIService(api_key=api_key)


# Global instance - will be created when needed
_ai_service_instance: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get or create AI service instance"""
    global _ai_service_instance
    
    if _ai_service_instance is None:
        _ai_service_instance = create_ai_service()
    
    return _ai_service_instance