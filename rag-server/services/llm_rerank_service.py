"""
基于大模型的重排序服务
使用大语言模型对搜索结果进行智能重排序和过滤
"""
import json
import time
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from loguru import logger

from services.ai_service import get_ai_service


class LLMRerankService:
    """基于大模型的重排序服务类"""

    def __init__(self):
        """初始化 LLM 重排序服务"""
        self.ai_service = get_ai_service()

    def _prepare_documents_for_llm(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        为大模型准备文档数据，将复杂的文档结构简化为易于理解的格式
        
        Args:
            candidates: 候选文档列表
            
        Returns:
            简化后的文档列表，包含序号映射
        """
        simplified_docs = []
        
        for idx, candidate in enumerate(candidates, 1):
            # 构建简化的文档表示
            doc_text_parts = []
            
            if candidate.get("title"):
                doc_text_parts.append(f"标题: {candidate['title']}")
            
            if candidate.get("description"):
                # 截取描述的前500字符避免过长
                description = candidate['description'][:500]
                if len(candidate['description']) > 500:
                    description += "..."
                doc_text_parts.append(f"描述: {description}")
            
            # 添加分类信息
            if candidate.get("category"):
                doc_text_parts.append(f"分类: {candidate['category']}")
            
            # 添加例题信息（只取前2个例题的问题部分）
            examples = candidate.get("examples", [])
            if examples:
                example_texts = []
                for i, example in enumerate(examples[:2], 1):
                    if isinstance(example, dict) and example.get("question"):
                        # 截取例题问题的前200字符
                        question = example['question'][:200]
                        if len(example['question']) > 200:
                            question += "..."
                        example_texts.append(f"例题{i}: {question}")
                
                if example_texts:
                    doc_text_parts.append(" | ".join(example_texts))
            
            # 添加标签
            tags = candidate.get("tags", [])
            if tags:
                doc_text_parts.append(f"标签: {', '.join(tags[:5])}")  # 最多5个标签
            
            simplified_doc = {
                "id": idx,  # 使用简单的数字ID
                "original_id": candidate.get("id", ""),  # 保留原始ID用于映射
                "content": " | ".join(doc_text_parts)
            }
            
            simplified_docs.append(simplified_doc)
        
        return simplified_docs

    def _create_rerank_prompt(self, query: str, documents: List[Dict[str, Any]]) -> str:
        """
        创建重排序提示词
        
        Args:
            query: 用户查询
            documents: 简化后的文档列表
            
        Returns:
            重排序提示词
        """
        docs_text = "\n".join([
            f"文档{doc['id']}: {doc['content']}" 
            for doc in documents
        ])
        
        prompt = f"""你是一个智能的搜索结果重排序助手。请根据用户查询对以下文档进行相关性评估和排序。

用户查询: {query}

候选文档:
{docs_text}

请按照以下要求进行评估:
1. 评估每个文档与用户查询的相关性
2. 给出0-100的相似度分数（0=完全不相关，100=高度相关）
3. 只返回相似度分数≥20的文档
4. 按相似度分数从高到低排序

请严格按照以下JSON格式返回结果：
```json
[
  {{
    "id": 1,
    "score": 85
  }},
  {{
    "id": 2, 
    "score": 65
  }}
]
```

注意:
- 只包含相似度≥20的文档
- 按相似度从高到低排序
- 如果所有文档相似度都<20，返回空数组"""

        return prompt

    async def rerank_documents(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: Optional[int] = None,
        request_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        使用大模型对文档进行重排序
        
        Args:
            query: 查询文本
            candidates: 候选文档列表
            top_k: 返回的最大文档数量
            request_id: 请求ID用于追踪
            
        Returns:
            重排序后的文档列表
        """
        if not request_id:
            request_id = str(time.time())[-8:]
        
        start_time = time.time()
        logger.info(f"[{request_id}] LLM rerank started with {len(candidates)} candidates")
        
        if not candidates:
            logger.warning(f"[{request_id}] No candidates to rerank")
            return []
        
        try:
            # 1. 准备文档数据
            prep_start = time.time()
            simplified_docs = self._prepare_documents_for_llm(candidates)
            prep_time = time.time() - prep_start
            logger.info(f"[{request_id}] Document preparation completed in {prep_time:.3f}s")
            logger.debug(f"[{request_id}] Prepared {len(simplified_docs)} simplified documents")
            
            # 2. 创建提示词
            prompt_start = time.time()
            prompt = self._create_rerank_prompt(query, simplified_docs)
            prompt_time = time.time() - prompt_start
            logger.info(f"[{request_id}] Prompt creation completed in {prompt_time:.3f}s")
            logger.debug(f"[{request_id}] Created rerank prompt ({len(prompt)} chars)")
            
            # 3. 调用大模型
            llm_start = time.time()
            try:
                logger.info(f"[{request_id}] LLM prompt: {prompt}")
                response = await self.ai_service.generate_response(
                    prompt=prompt,
                    temperature=0.1,  # 低温度确保一致性
                    max_tokens=2000   # 限制输出长度
                )
                logger.info(f"[{request_id}] LLM response: {response}")
                llm_time = time.time() - llm_start
                logger.info(f"[{request_id}] LLM call completed in {llm_time:.3f}s")
                
            except Exception as e:
                llm_time = time.time() - llm_start
                logger.error(f"[{request_id}] LLM call failed after {llm_time:.3f}s: {e}")
                # 如果大模型调用失败，返回原始顺序
                return candidates[:top_k] if top_k else candidates
            
            # 4. 解析大模型响应
            parse_start = time.time()
            try:
                # 提取JSON部分
                response_text = response.strip()
                if "```json" in response_text:
                    json_start = response_text.find("```json") + 7
                    json_end = response_text.find("```", json_start)
                    json_text = response_text[json_start:json_end].strip()
                else:
                    # 尝试直接解析整个响应
                    json_text = response_text
                
                llm_result = json.loads(json_text)
                parse_time = time.time() - parse_start
                logger.info(f"[{request_id}] Response parsing completed in {parse_time:.3f}s")
                logger.debug(f"[{request_id}] Successfully parsed LLM response")
                
                # 确保结果是数组格式
                if not isinstance(llm_result, list):
                    logger.error(f"[{request_id}] Expected array but got {type(llm_result)}")
                    return candidates[:top_k] if top_k else candidates
                
            except json.JSONDecodeError as e:
                parse_time = time.time() - parse_start
                logger.error(f"[{request_id}] Failed to parse LLM response as JSON after {parse_time:.3f}s: {e}")
                logger.debug(f"[{request_id}] Raw response: {response[:500]}...")
                # 解析失败时返回原始顺序
                return candidates[:top_k] if top_k else candidates
            
            # 5. 构建重排序结果
            build_start = time.time()
            reranked_results = []
            id_to_candidate = {i+1: candidates[i] for i in range(len(candidates))}
            
            for result in llm_result:
                doc_id = result.get("id")
                score = result.get("score", 0)
                
                if doc_id in id_to_candidate and score >= 20:
                    original_candidate = id_to_candidate[doc_id].copy()
                    original_candidate["rerank_score"] = float(score)
                    original_candidate["llm_similarity_score"] = float(score)
                    original_candidate["rerank_method"] = "llm"
                    
                    reranked_results.append(original_candidate)
            
            # 6. 应用 top_k 限制
            if top_k is not None:
                reranked_results = reranked_results[:top_k]
            
            build_time = time.time() - build_start
            logger.info(f"[{request_id}] Result building completed in {build_time:.3f}s")
            
            total_time = time.time() - start_time
            filtered_count = len(llm_result)
            final_count = len(reranked_results)
            
            logger.info(f"[{request_id}] LLM rerank completed in {total_time:.3f}s")
            logger.info(f"[{request_id}] Results: {len(candidates)} → {filtered_count} filtered → {final_count} final")
            logger.info(f"[{request_id}] Timing breakdown - Prep: {prep_time:.3f}s, Prompt: {prompt_time:.3f}s, LLM: {llm_time:.3f}s, Parse: {parse_time:.3f}s, Build: {build_time:.3f}s")
            
            return reranked_results
            
        except Exception as e:
            logger.error(f"[{request_id}] LLM rerank failed: {e}")
            # 出现任何错误时返回原始顺序
            return candidates[:top_k] if top_k else candidates

    def get_model_info(self) -> Dict[str, Any]:
        """
        获取重排序模型信息
        
        Returns:
            模型信息字典
        """
        return {
            "model_type": "llm_rerank",
            "ai_service": str(type(self.ai_service).__name__),
            "status": "ready",
            "features": [
                "semantic_understanding",
                "relevance_filtering", 
                "similarity_scoring"
            ]
        }

    async def health_check(self) -> Dict[str, Any]:
        """
        健康检查
        
        Returns:
            健康状态信息
        """
        try:
            # 简单测试大模型连接
            test_response = await self.ai_service.generate_response(
                prompt="请回复'OK'",
                temperature=0,
                max_tokens=10
            )
            
            is_healthy = "OK" in test_response or "ok" in test_response.lower()
            
            return {
                "status": "healthy" if is_healthy else "degraded",
                "model_type": "llm_rerank",
                "ai_service": str(type(self.ai_service).__name__),
                "test_response": test_response[:50] if test_response else None
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "model_type": "llm_rerank", 
                "error": str(e)
            }


# 创建全局实例
llm_rerank_service = LLMRerankService()
