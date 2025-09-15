"""
重排序服务模块
使用 Cross-Encoder 模型对搜索结果进行重排序，提升相关性
"""
import asyncio
import time
import uuid
from typing import List, Dict, Any, Tuple, Optional
from sentence_transformers import CrossEncoder
from loguru import logger

from config import settings


class RerankService:
    """重排序服务类"""

    def __init__(self):
        """初始化重排序服务"""
        self.model_name = settings.RERANK_MODEL
        self.model = None
        self._is_loading = False
        self._load_lock = asyncio.Lock()

    async def _load_model(self, request_id: Optional[str] = None):
        """
        异步加载模型

        Args:
            request_id: 请求ID用于追踪
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        if self.model is not None:
            return

        async with self._load_lock:
            if self.model is not None:
                return

            if self._is_loading:
                # 等待其他任务完成加载
                while self._is_loading:
                    await asyncio.sleep(0.1)
                return

            self._is_loading = True
            logger.info(f"[{request_id}] Loading rerank model: {self.model_name}")

            try:
                load_start = time.time()

                # 在线程池中加载模型以避免阻塞事件循环
                loop = asyncio.get_event_loop()
                self.model = await loop.run_in_executor(
                    None,
                    lambda: CrossEncoder(self.model_name)
                )

                load_time = time.time() - load_start
                logger.info(f"[{request_id}] Rerank model loaded successfully in {load_time:.3f}s")

            except Exception as e:
                logger.error(f"[{request_id}] Failed to load rerank model {self.model_name}: {e}")
                raise
            finally:
                self._is_loading = False

    async def rerank_results(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: Optional[int] = None,
        request_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        对候选结果进行重排序

        Args:
            query: 原始查询
            candidates: 候选结果列表
            top_k: 返回的top结果数量，None表示返回所有重排序后的结果
            request_id: 请求ID用于追踪

        Returns:
            重排序后的结果列表
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        if not candidates:
            logger.warning(f"[{request_id}] No candidates provided for reranking")
            return []

        start_time = time.time()
        logger.info(f"[{request_id}] Starting reranking for {len(candidates)} candidates")

        try:
            # 确保模型已加载
            await self._load_model(request_id)

            if self.model is None:
                logger.error(f"[{request_id}] Rerank model not available")
                return candidates

            # 准备查询-文档对
            pairs = []
            for candidate in candidates:
                # 构建候选文档的文本表示
                doc_text_parts = []

                if candidate.get("title"):
                    doc_text_parts.append(f"标题: {candidate['title']}")

                if candidate.get("description"):
                    doc_text_parts.append(f"描述: {candidate['description']}")

                # 添加例题信息
                examples = candidate.get("examples", [])
                if examples:
                    for i, example in enumerate(examples[:2], 1):  # 只取前2个例题
                        if isinstance(example, dict):
                            if example.get("question"):
                                doc_text_parts.append(f"例题{i}: {example['question']}")

                # 添加标签
                tags = candidate.get("tags", [])
                if tags:
                    doc_text_parts.append(f"标签: {', '.join(tags)}")

                doc_text = " ".join(doc_text_parts)
                pairs.append([query, doc_text])

            # 在线程池中执行重排序以避免阻塞
            rerank_start = time.time()
            loop = asyncio.get_event_loop()
            scores = await loop.run_in_executor(
                None,
                lambda: self.model.predict(pairs)
            )
            rerank_time = time.time() - rerank_start

            # 将分数添加到候选结果中并排序
            scored_candidates = []
            for i, candidate in enumerate(candidates):
                scored_candidate = candidate.copy()
                scored_candidate["rerank_score"] = float(scores[i])
                scored_candidates.append(scored_candidate)

            # 按重排序分数降序排列
            reranked_results = sorted(
                scored_candidates,
                key=lambda x: x["rerank_score"],
                reverse=True
            )

            # 限制返回数量
            if top_k is not None:
                reranked_results = reranked_results[:top_k]

            total_time = time.time() - start_time
            logger.info(f"[{request_id}] Reranking completed in {total_time:.3f}s")
            logger.info(f"[{request_id}] Model inference took {rerank_time:.3f}s")
            logger.info(f"[{request_id}] Returning {len(reranked_results)} reranked results")

            # 记录分数范围
            if reranked_results:
                min_score = min(r["rerank_score"] for r in reranked_results)
                max_score = max(r["rerank_score"] for r in reranked_results)
                logger.debug(f"[{request_id}] Rerank scores range: {min_score:.4f} to {max_score:.4f}")

            return reranked_results

        except Exception as e:
            total_time = time.time() - start_time
            logger.error(f"[{request_id}] Reranking failed after {total_time:.3f}s: {e}")
            # 如果重排序失败，返回原始结果
            return candidates

    async def hybrid_score_fusion(
        self,
        vector_results: List[Dict[str, Any]],
        text_results: List[Dict[str, Any]],
        vector_weight: float = 0.6,
        text_weight: float = 0.4,
        request_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        融合向量搜索和文本搜索的结果

        Args:
            vector_results: 向量搜索结果
            text_results: 文本搜索结果
            vector_weight: 向量搜索权重
            text_weight: 文本搜索权重
            request_id: 请求ID用于追踪

        Returns:
            融合后的结果列表
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        logger.info(f"[{request_id}] Fusing {len(vector_results)} vector results and {len(text_results)} text results")

        # 创建结果字典，合并两个来源的结果
        merged_results = {}

        # 处理向量搜索结果
        for result in vector_results:
            doc_id = result.get("id")
            if doc_id:
                # 将距离转换为相似度分数 (1 - distance)
                vector_score = 1.0 - result.get("distance", 1.0)
                vector_score = max(0.0, min(1.0, vector_score))  # 限制在0-1之间

                merged_results[doc_id] = {
                    **result,
                    "vector_score": vector_score,
                    "text_score": 0.0
                }

        # 处理文本搜索结果
        text_scores = []
        for result in text_results:
            if result.get("es_score"):
                text_scores.append(result["es_score"])

        # 归一化文本搜索分数
        if text_scores:
            max_text_score = max(text_scores)
            min_text_score = min(text_scores)
            score_range = max_text_score - min_text_score

            for result in text_results:
                doc_id = result.get("id")
                if doc_id:
                    raw_score = result.get("es_score", 0.0)

                    # 归一化到0-1范围
                    if score_range > 0:
                        normalized_score = (raw_score - min_text_score) / score_range
                    else:
                        normalized_score = 1.0 if raw_score > 0 else 0.0

                    if doc_id in merged_results:
                        merged_results[doc_id]["text_score"] = normalized_score
                        # 如果文本结果有更多信息，更新它
                        merged_results[doc_id].update({
                            k: v for k, v in result.items()
                            if k not in merged_results[doc_id] or not merged_results[doc_id][k]
                        })
                    else:
                        merged_results[doc_id] = {
                            **result,
                            "vector_score": 0.0,
                            "text_score": normalized_score
                        }

        # 计算融合分数
        final_results = []
        for doc_id, result in merged_results.items():
            vector_score = result.get("vector_score", 0.0)
            text_score = result.get("text_score", 0.0)

            # 计算加权融合分数
            fusion_score = vector_weight * vector_score + text_weight * text_score
            result["fusion_score"] = fusion_score
            result["hybrid_metadata"] = {
                "vector_score": vector_score,
                "text_score": text_score,
                "vector_weight": vector_weight,
                "text_weight": text_weight
            }

            final_results.append(result)

        # 按融合分数排序
        final_results.sort(key=lambda x: x["fusion_score"], reverse=True)

        logger.info(f"[{request_id}] Fusion completed, returning {len(final_results)} results")

        # 记录分数统计
        if final_results:
            min_fusion = min(r["fusion_score"] for r in final_results)
            max_fusion = max(r["fusion_score"] for r in final_results)
            logger.debug(f"[{request_id}] Fusion scores range: {min_fusion:.4f} to {max_fusion:.4f}")

        return final_results

    def get_model_info(self) -> Dict[str, Any]:
        """
        获取重排序模型信息

        Returns:
            模型信息字典
        """
        return {
            "model_name": self.model_name,
            "is_loaded": self.model is not None,
            "is_loading": self._is_loading,
            "status": "loaded" if self.model is not None else ("loading" if self._is_loading else "not_loaded")
        }

    async def health_check(self) -> Dict[str, Any]:
        """
        健康检查

        Returns:
            服务状态信息
        """
        try:
            model_info = self.get_model_info()
            return {
                "status": "healthy" if model_info["is_loaded"] else "initializing",
                "model_info": model_info
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }


# 全局重排序服务实例
rerank_service = RerankService()