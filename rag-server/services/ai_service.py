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
    """AI service for knowledge point generation using OpenAI-compatible API"""

    def __init__(self, api_key: str, api_base: str = "https://api.openai.com", model: str = "gpt-3.5-turbo"):
        self.api_key = api_key
        self.api_base = api_base.rstrip('/')
        self.model = model
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
    
    async def generate_response(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """Generate a text response using AI model"""
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        logger.info(f"[{request_id}] Starting text generation")
        logger.info(f"[{request_id}] Prompt length: {len(prompt)} characters")
        
        try:
            # Prepare API request
            url = f"{self.api_base}/chat/completions"
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "thinking": {
                    "type": "disabled"
                }
            }
            
            # Make API request
            async with aiohttp.ClientSession() as session:
                api_start = time.time()
                async with session.post(url, json=payload, headers=self.headers) as response:
                    api_time = time.time() - api_start
                    
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"[{request_id}] API error {response.status}: {error_text}")
                        raise Exception(f"API error {response.status}: {error_text}")
                    
                    response_data = await response.json()
                    logger.info(f"[{request_id}] API call completed in {api_time:.3f}s")
                    logger.info(f"[{request_id}] API response: {response_data}")
            
            # Extract response text
            if 'choices' not in response_data or not response_data['choices']:
                logger.error(f"[{request_id}] No choices in API response")
                raise Exception("No response from AI model")
            
            generated_text = response_data['choices'][0]['message']['content']
            
            total_time = time.time() - start_time
            logger.info(f"[{request_id}] Text generation completed in {total_time:.3f}s")
            logger.info(f"[{request_id}] Generated text length: {len(generated_text)} characters")
            
            return generated_text
            
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Text generation failed after {total_time:.3f}s: {str(e)}")
            raise

    async def generate_knowledge_points(self, text: str, max_points: int = 10, user_requirements: Optional[str] = None) -> List[KnowledgePointData]:
        """Generate knowledge points from text using AI model"""
        # Generate request ID for tracking
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        logger.info(f"[{request_id}] Starting knowledge point generation")
        logger.info(f"[{request_id}] Input text length: {len(text)} characters")
        logger.info(f"[{request_id}] Max knowledge points: {max_points}")
        logger.info(f"[{request_id}] User requirements: {user_requirements or 'None'}")
        logger.info(f"[{request_id}] Document text: {text}")
        
        try:
            # Prepare the prompt for knowledge point extraction
            logger.debug(f"[{request_id}] Creating extraction prompt")
            prompt_start = time.time()
            prompt = self._create_extraction_system_prompt()
            prompt_time = time.time() - prompt_start
            logger.debug(f"[{request_id}] Prompt created in {prompt_time:.3f}s (length: {len(prompt)} chars)")
            
            # Call AI API
            logger.info(f"[{request_id}] Calling AI API")
            api_start = time.time()
            response = await self._call_ai_api(prompt, text, user_requirements, request_id)
            api_time = time.time() - api_start
            logger.info(f"[{request_id}] AI API call completed in {api_time:.3f}s")
            
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
    
    def _create_extraction_system_prompt(self) -> str:
        """Create a structured prompt for knowledge point extraction"""
        prompt = f"""
你是一个数学知识专家，需要从给定的文档中智能提取数学知识点。

【第一步：文档结构分析】

请结合用户提供的文本和要求，智能提取数学知识点：

- 将概念、公式、方法、原理等整合到description中
- 完全保持原文中例题的内容和解题步骤，不做任何修改
- 如果有课后练习，也作为examples包含
- 每个知识点应该是完整且独立的概念

【第三步：输出格式】
按以下JSON格式输出：
{{
  "knowledge_points": [
    {{
      "title": "知识点标题",
      "description": "完整描述，包含概念、定义、公式、方法、原理、应用场景等。对于完整教学材料，这里应该包含所有相关的理论内容。保持原文的格式、换行、编号、加粗等结构化信息。",
      "category": "使用以下预定义的英文分类值之一：sequence（数列）、algebra（代数）、geometry（几何）、calculus（微积分）、statistics（概率统计）、linear-algebra（线性代数）、discrete-math（离散数学）、number-theory（数论）、general（通用）",
      "examples": [
        {{
          "question": "原文中的例题问题（完全保持原文，包括换行、数学公式、格式）",
          "solution": "原文中的解答过程（完全保持原文格式、步骤、换行、编号、数学公式等，不修改）", 
          "difficulty": "根据题目复杂度判断：easy|medium|hard"
        }}
      ],
      "tags": ["核心标签1", "核心标签2", "核心标签3"]
    }}
  ]
}}

【重要要求】
1. 例题内容必须完全来自原文，保持原有的表述、符号、解题步骤不变
2. 不要修改、简化或重新组织例题的解答过程
3. description要充分整合原文的所有理论内容
4. 优先保持内容完整性，避免为了凑数量而拆分
5. 保持原文的格式和换行信息，包括数学公式、分段、缩进等
6. 在description和examples中保留原文的结构化信息（如：1. 2. 3.编号、**加粗**、分段等）
7. 数学公式和符号必须完全按照原文格式保留
8. category字段必须使用预定义的英文分类值，不要使用中文或其他自定义分类

【JSON格式要求】
9. 必须输出标准的JSON格式，确保所有字符串正确转义
10. 数学公式中的反斜杠必须双重转义，例如：\\\\frac、\\\\sqrt、\\\\dots、\\\\times等
11. 换行符使用\\n表示，制表符使用\\t表示
12. 所有双引号在字符串内部必须转义为\\"
13. JSON结构必须完整且语法正确，避免任何解析错误

"""
        return prompt
    
    def _format_user_requirements(self, user_requirements: Optional[str]) -> str:
        """Format user requirements for inclusion in the prompt"""
        if not user_requirements or not user_requirements.strip():
            return "用户未提供特殊要求，按照标准流程提取知识点。"
        
        return f"""用户提出了以下特殊要求，请在提取知识点时重点关注：

{user_requirements.strip()}

请确保在提取知识点时充分考虑这些要求，并在适当的地方体现用户的需求。"""
    
    def _fix_latex_escapes(self, json_content: str) -> str:
        """Fix common LaTeX escape sequences that cause JSON parsing errors"""
        import re
        
        # 更彻底的方法：直接在字符串值内修复所有单反斜杠
        def fix_string_escapes(match):
            """修复JSON字符串值内的所有转义问题"""
            full_match = match.group(0)
            # 提取引号内的内容
            string_content = full_match[1:-1]  # 去掉前后的引号
            
            # 1. 先修复已经被意外双重转义的情况
            # 例如：\\\\frac -> \\frac (避免过度转义)
            string_content = re.sub(r'\\\\\\\\', r'\\\\', string_content)
            
            # 2. 修复所有单反斜杠后跟字母或特殊字符的情况
            # 这会捕获所有LaTeX命令，包括我们之前遗漏的
            string_content = re.sub(r'(?<!\\)\\(?=[a-zA-Z()[\]{}])', r'\\\\', string_content)
            
            # 3. 修复其他特殊的转义字符
            replacements = {
                '\\n': '\\\\n',   # 换行符
                '\\t': '\\\\t',   # 制表符  
                '\\r': '\\\\r',   # 回车符
                '\\"': '\\\\"',   # 双引号
            }
            
            for old, new in replacements.items():
                # 只替换不是已经正确转义的情况
                string_content = re.sub(f'(?<!\\\\){re.escape(old)}', new, string_content)
            
            # 重新添加引号
            return f'"{string_content}"'
        
        # 只对JSON字符串值（在双引号内的内容）进行修复
        # 这个正则表达式匹配完整的字符串值，包括转义的引号
        json_content = re.sub(r'"(?:[^"\\]|\\.)*"', fix_string_escapes, json_content)
        
        return json_content
    
    async def _call_ai_api(self, prompt: str, text: str, user_requirements: Optional[str] = None, request_id: str = None) -> str:
        """Call AI API to generate content"""
        url = f"{self.api_base}/chat/completions"

        user_content = f"""
文档内容：
{text}

请直接输出JSON：
""" if not user_requirements else f"""
文档内容：
{text}

我的要求：
{user_requirements}

请直接输出JSON：
"""
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": user_content
                }
            ],
            "max_tokens": 32768,
            "temperature": 0.3,
            "stream": False,
            "thinking": {
                "type": "disabled"
            }
        }
        
        # Log request details (without sensitive content)
        logger.info(f"[{request_id}] AI API request - Model: {payload['model']}, Max tokens: {payload['max_tokens']}, Temperature: {payload['temperature']}")
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
                        logger.error(f"[{request_id}] HTTP error {response.status}: {error_text}")
                        raise Exception(f"AI API returned status {response.status}: {error_text[:200]}")
                    
                    result = await response.json()
            
            # Log response details
            logger.debug(f"[{request_id}] LLM Response: {result}")
            
            if "choices" not in result or len(result["choices"]) == 0:
                logger.error(f"[{request_id}] Invalid API response: no choices found")
                raise Exception("No response from AI API")
            
            # Extract usage information if available
            if "usage" in result:
                usage = result["usage"]
                logger.info(f"[{request_id}] Token usage - Prompt: {usage.get('prompt_tokens', 'N/A')}, "
                           f"Completion: {usage.get('completion_tokens', 'N/A')}, "
                           f"Total: {usage.get('total_tokens', 'N/A')}")
            
            content = result["choices"][0]["message"]["content"]
            logger.info(f"[{request_id}] AI response received - Content length: {len(content)} characters")
            logger.debug(f"[{request_id}] Response content preview: {content[:200]}...")
            
            return content.strip()
            
        except aiohttp.ClientError as e:
            logger.error(f"[{request_id}] AI API request failed: {e}")
            logger.error(f"[{request_id}] Request URL: {url}")
            raise Exception(f"AI API request failed: {str(e)}")
        except asyncio.TimeoutError as e:
            logger.error(f"[{request_id}] AI API request timeout: {e}")
            raise Exception(f"AI API request timeout: {str(e)}")
        except json.JSONDecodeError as e:
            logger.error(f"[{request_id}] Failed to decode JSON response: {e}")
            raise Exception(f"Invalid JSON response from AI API: {str(e)}")
        except Exception as e:
            logger.error(f"[{request_id}] Error calling AI API: {e}")
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
            
            # Fix common LaTeX escape issues in JSON
            # Replace problematic LaTeX commands that cause JSON parsing errors
            json_content = self._fix_latex_escapes(json_content)
            logger.debug(f"[{request_id}] Fixed LaTeX escapes in JSON content")
            
            # Parse JSON
            logger.debug(f"[{request_id}] Attempting to parse JSON")
            parsed_data = json.loads(json_content)
            logger.info(f"[{request_id}] Successfully parsed JSON response")
            
            # Validate structure
            if "knowledge_points" not in parsed_data:
                logger.error(f"[{request_id}] Invalid response format: missing 'knowledge_points' key")
                logger.error(f"[{request_id}] Available keys: {list(parsed_data.keys())}")
                raise ValueError("Invalid response format: missing 'knowledge_points'")
            
            # Log document type if present
            document_type = parsed_data.get("document_type", "unknown")
            logger.info(f"[{request_id}] Document type identified as: {document_type}")
            
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

    api_key = settings.AI_API_KEY
    if not api_key:
        raise ValueError("AI_API_KEY environment variable is required")

    return AIService(
        api_key=api_key,
        api_base=settings.AI_BASE_URL,
        model=settings.AI_MODEL
    )


# Global instance - will be created when needed
_ai_service_instance: Optional[AIService] = None


def get_ai_service() -> AIService:
    """Get or create AI service instance"""
    global _ai_service_instance
    
    if _ai_service_instance is None:
        _ai_service_instance = create_ai_service()
    
    return _ai_service_instance