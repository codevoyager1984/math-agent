"""
AI service for generating knowledge points using DeepSeek API
"""
import json
import time
import uuid
from typing import List, Optional, Dict, Any, AsyncGenerator
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
            knowledge_points = self._parse_ai_response(response, request_id, text)
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
你是一个数学知识专家，需要从给定的文档中智能提取数学知识点的位置信息。

你的任务是分析文档内容，识别知识点，并返回每个知识点在原文中的位置信息，而不是返回具体内容。

【分析要求】
1. 识别文档中的主要知识点（概念、定义、公式、方法等）
2. 识别每个知识点相关的例题和练习
3. 为每个知识点确定合适的分类和标签
4. 确定每个内容块在原文中的位置范围

【输出格式】
返回JSON格式，包含位置信息：
{{
  "knowledge_points": [
    {{
      "title": "知识点标题（简短概括）",
      "category": "预定义分类：sequence|algebra|geometry|calculus|statistics|linear-algebra|discrete-math|number-theory|general",
      "description_range": {{
        "start_line": 起始行号（从1开始）,
        "end_line": 结束行号
      }},
      "examples": [
        {{
          "question_range": {{
            "start_line": 问题起始行号,
            "end_line": 问题结束行号
          }},
          "solution_range": {{
            "start_line": 解答起始行号,
            "end_line": 解答结束行号
          }},
          "difficulty": "easy|medium|hard"
        }}
      ],
      "tags": ["标签1", "标签2", "标签3"]
    }}
  ]
}}

【重要说明】
1. 行号从1开始计数
2. description_range应该包含该知识点的所有理论内容
3. examples中的question_range和solution_range要准确对应原文中的例题
4. 确保位置范围不重叠，每个范围都是完整的内容块
5. 优先保持内容的完整性，避免过度拆分
6. 只返回位置信息，不返回具体文本内容

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
    
    def _extract_content_by_lines(self, text: str, start_line: int, end_line: int) -> str:
        """Extract content from text by line numbers"""
        lines = text.split('\n')
        
        # Convert to 0-based indexing
        start_idx = max(0, start_line - 1)
        end_idx = min(len(lines), end_line)
        
        # Extract the specified lines
        extracted_lines = lines[start_idx:end_idx]
        return '\n'.join(extracted_lines).strip()
    
    def _create_knowledge_points_from_positions(self, text: str, position_data: dict) -> List[KnowledgePointData]:
        """Create knowledge point objects from position information"""
        knowledge_points = []
        
        for kp_data in position_data.get("knowledge_points", []):
            # Extract description content
            desc_range = kp_data.get("description_range", {})
            description = self._extract_content_by_lines(
                text, 
                desc_range.get("start_line", 1),
                desc_range.get("end_line", 1)
            )
            
            # Extract examples
            examples = []
            for ex_data in kp_data.get("examples", []):
                question_range = ex_data.get("question_range", {})
                solution_range = ex_data.get("solution_range", {})
                
                question = self._extract_content_by_lines(
                    text,
                    question_range.get("start_line", 1),
                    question_range.get("end_line", 1)
                )
                
                solution = self._extract_content_by_lines(
                    text,
                    solution_range.get("start_line", 1),
                    solution_range.get("end_line", 1)
                )
                
                if question and solution:
                    example = ExampleData(
                        question=question,
                        solution=solution,
                        difficulty=ex_data.get("difficulty", "medium")
                    )
                    examples.append(example)
            
            # Create knowledge point
            kp = KnowledgePointData(
                title=kp_data.get("title", "未命名知识点"),
                description=description,
                category=kp_data.get("category", "general"),
                examples=examples,
                tags=kp_data.get("tags", [])
            )
            knowledge_points.append(kp)
        
        return knowledge_points
    
    async def _call_ai_api(self, prompt: str, text: str, user_requirements: Optional[str] = None, request_id: str = None) -> str:
        """Call AI API to generate content"""
        url = f"{self.api_base}/chat/completions"

        # Add line numbers to the text for position reference
        lines = text.split('\n')
        numbered_text = '\n'.join(f"{i+1:3d}: {line}" for i, line in enumerate(lines))
        
        user_content = f"""
文档内容（带行号）：
{numbered_text}

请直接输出JSON：
""" if not user_requirements else f"""
文档内容（带行号）：
{numbered_text}

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
            "stream": False
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
            logger.debug(f"[{request_id}] LLM Response: {json.dumps(result, indent=2)}")
            
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
    
    def _parse_ai_response(self, response: str, request_id: str, original_text: str) -> List[KnowledgePointData]:
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
            logger.debug(f"[{request_id}] JSON content preview: {json_content}...")
            
            # Parse JSON (position data should be simple, no LaTeX escapes needed)
            logger.debug(f"[{request_id}] Attempting to parse JSON")
            parsed_data = json.loads(json_content)
            logger.info(f"[{request_id}] Successfully parsed JSON response")
            
            # Validate structure
            if "knowledge_points" not in parsed_data:
                logger.error(f"[{request_id}] Invalid response format: missing 'knowledge_points' key")
                logger.error(f"[{request_id}] Available keys: {list(parsed_data.keys())}")
                raise ValueError("Invalid response format: missing 'knowledge_points'")
            
            raw_knowledge_points = parsed_data["knowledge_points"]
            logger.info(f"[{request_id}] Found {len(raw_knowledge_points)} knowledge points with position information")
            
            # Create knowledge points from position information
            logger.debug(f"[{request_id}] Creating knowledge points from position data")
            knowledge_points = self._create_knowledge_points_from_positions(original_text, parsed_data)
            
            logger.info(f"[{request_id}] Response parsing completed successfully")
            logger.info(f"[{request_id}] Successfully created {len(knowledge_points)} knowledge points")
            
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

    async def stream_chat_response(
        self,
        messages: List[Dict[str, str]],
        request_id: str = None,
        temperature: float = 0.7,
        max_tokens: int = 4000
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        流式聊天响应

        Args:
            messages: 对话消息列表
            request_id: 请求ID
            temperature: 温度参数
            max_tokens: 最大token数

        Yields:
            Dict[str, Any]: 包含流式响应数据的字典
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        start_time = time.time()

        logger.info(f"[{request_id}] Starting stream chat response")
        logger.info(f"[{request_id}] Messages count: {len(messages)}")
        logger.debug(f"[{request_id}] Last user message: {messages[-1]['content'][:100] if messages and messages[-1].get('content') else 'None'}...")

        try:
            # 准备API请求
            url = f"{self.api_base}/chat/completions"
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": True,  # 启用流式响应
                "thinking": {
                    "type": "enabled"  # 启用思考过程流式输出
                }
            }

            logger.info(f"[{request_id}] Stream API request - Model: {payload['model']}, Stream: True, Thinking: stream")
            logger.debug(f"[{request_id}] Request payload prepared")

            # 进行流式请求
            timeout = aiohttp.ClientTimeout(total=300)  # 5分钟超时，适合流式响应

            async with aiohttp.ClientSession(timeout=timeout) as session:
                request_start = time.time()
                async with session.post(url, headers=self.headers, json=payload) as response:
                    request_time = time.time() - request_start

                    logger.info(f"[{request_id}] Stream connection established in {request_time:.3f}s")
                    logger.debug(f"[{request_id}] Response status: {response.status}")

                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"[{request_id}] Stream API error {response.status}: {error_text}")
                        yield {
                            "type": "error",
                            "data": {
                                "error": f"API error {response.status}: {error_text[:200]}"
                            }
                        }
                        return

                    # 处理流式响应
                    buffer = ""
                    chunk_count = 0
                    reasoning_content = ""
                    message_content = ""

                    logger.info(f"[{request_id}] Starting to process stream chunks")

                    async for chunk in response.content.iter_chunked(1024):
                        chunk_count += 1
                        chunk_text = chunk.decode('utf-8', errors='ignore')
                        buffer += chunk_text

                        # 按行处理SSE数据
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.strip()

                            if not line or not line.startswith('data: '):
                                continue

                            # 移除'data: '前缀
                            json_str = line[6:]

                            # 检查是否是结束标记
                            if json_str == '[DONE]':
                                logger.info(f"[{request_id}] Stream completed - Total chunks: {chunk_count}")
                                yield {
                                    "type": "done",
                                    "data": {
                                        "reasoning": reasoning_content,
                                        "content": message_content,
                                        "total_time": time.time() - start_time
                                    }
                                }
                                return

                            try:
                                # 解析JSON数据
                                data = json.loads(json_str)

                                # 检查是否包含选择
                                if 'choices' in data and data['choices']:
                                    choice = data['choices'][0]

                                    # 处理思考过程 (reasoning)
                                    if 'reasoning' in choice:
                                        reasoning_delta = choice['reasoning'].get('content', '')
                                        if reasoning_delta:
                                            reasoning_content += reasoning_delta
                                            logger.debug(f"[{request_id}] Reasoning chunk: {len(reasoning_delta)} chars")
                                            yield {
                                                "type": "reasoning",
                                                "data": {
                                                    "reasoning": reasoning_delta,
                                                    "full_reasoning": reasoning_content
                                                }
                                            }

                                    # 处理普通消息内容
                                    if 'delta' in choice:
                                        delta = choice['delta']
                                        if 'content' in delta and delta['content']:
                                            content_delta = delta['content']
                                            message_content += content_delta
                                            logger.debug(f"[{request_id}] Content chunk: {len(content_delta)} chars")
                                            yield {
                                                "type": "content",
                                                "data": {
                                                    "content": content_delta,
                                                    "full_content": message_content
                                                }
                                            }

                                    # 检查是否有完成的消息
                                    if 'message' in choice:
                                        message = choice['message']
                                        if message.get('content'):
                                            # 尝试解析知识点JSON
                                            try:
                                                knowledge_points = self._extract_knowledge_points_from_content(message['content'])
                                                if knowledge_points:
                                                    logger.info(f"[{request_id}] Extracted {len(knowledge_points)} knowledge points")
                                                    yield {
                                                        "type": "knowledge_points",
                                                        "data": {
                                                            "knowledge_points": knowledge_points,
                                                            "content": message['content']
                                                        }
                                                    }
                                            except Exception as e:
                                                logger.warning(f"[{request_id}] Failed to parse knowledge points: {e}")

                            except json.JSONDecodeError as e:
                                logger.warning(f"[{request_id}] Failed to parse JSON chunk: {e}")
                                logger.debug(f"[{request_id}] Invalid JSON: {json_str[:200]}...")
                                continue
                            except Exception as e:
                                logger.error(f"[{request_id}] Error processing stream chunk: {e}")
                                continue

        except asyncio.TimeoutError:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Stream timeout after {total_time:.3f}s")
            yield {
                "type": "error",
                "data": {
                    "error": "Request timeout"
                }
            }
        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Stream chat error after {total_time:.3f}s: {str(e)}")
            logger.error(f"[{request_id}] Exception type: {type(e).__name__}")
            yield {
                "type": "error",
                "data": {
                    "error": str(e)
                }
            }

    def _extract_knowledge_points_from_content(self, content: str) -> Optional[List[Dict[str, Any]]]:
        """从内容中提取知识点JSON"""
        try:
            # 尝试找到JSON内容
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1

            if start_idx == -1 or end_idx == 0:
                return None

            json_content = content[start_idx:end_idx]
            parsed_data = json.loads(json_content)

            if "knowledge_points" in parsed_data:
                return parsed_data["knowledge_points"]

            return None

        except (json.JSONDecodeError, Exception):
            return None

    async def generate_initial_knowledge_points(
        self,
        extracted_text: str,
        max_points: int = 10,
        user_requirements: Optional[str] = None,
        request_id: str = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        生成初始知识点（流式）

        Args:
            extracted_text: 提取的文档文本
            max_points: 最大知识点数量
            user_requirements: 用户要求
            request_id: 请求ID
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        logger.info(f"[{request_id}] Generating initial knowledge points (streaming)")
        logger.info(f"[{request_id}] Text length: {len(extracted_text)} chars, Max points: {max_points}")

        # 准备消息
        system_prompt = self._create_extraction_system_prompt()

        # 添加行号到文本
        lines = extracted_text.split('\n')
        numbered_text = '\n'.join(f"{i+1:3d}: {line}" for i, line in enumerate(lines))

        user_content = f"""
文档内容（带行号）：
{numbered_text[:8000]}  # 限制长度避免token超限

请分析这个文档并生成 {max_points} 个数学知识点。"""

        if user_requirements:
            user_content += f"\n\n用户特殊要求：\n{user_requirements}"

        user_content += "\n\n请先展示你的分析思考过程，然后提供JSON格式的知识点结果。"

        messages = [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_content
            }
        ]

        # 使用流式聊天方法
        async for chunk in self.stream_chat_response(messages, request_id):
            yield chunk


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