#!/usr/bin/env python3
"""
搜索评分测试脚本
用于诊断和验证搜索结果的相似度计算是否正确
"""

import requests
import json
import math
from typing import Dict, Any, List

# 配置
RAG_SERVER_URL = "http://localhost:8000"  # 根据实际情况调整

def test_search_query(query: str, expected_relevance: str = "") -> Dict[str, Any]:
    """测试单个搜索查询"""
    print(f"\n🔍 测试查询: '{query}'")
    if expected_relevance:
        print(f"预期相关性: {expected_relevance}")

    try:
        response = requests.post(
            f"{RAG_SERVER_URL}/api/knowledge-base/query",
            json={
                "query": query,
                "n_results": 3,
                "search_mode": "hybrid",
                "vector_weight": 0.6,
                "text_weight": 0.4,
                "enable_rerank": True,
                "rerank_top_k": 5
            },
            timeout=30
        )

        if response.status_code != 200:
            print(f"❌ 请求失败: {response.status_code}")
            return {"error": f"HTTP {response.status_code}"}

        data = response.json()
        results = data.get("results", [])

        print(f"📊 返回 {len(results)} 个结果")

        for i, result in enumerate(results):
            title = result.get("metadata", {}).get("title", "无标题")[:50]
            distance = result.get("distance", 0)
            vector_score = result.get("vector_score", 0)
            text_score = result.get("text_score", 0)
            fusion_score = result.get("fusion_score", 0)
            rerank_score = result.get("rerank_score", 0)
            final_score = result.get("final_score", 0)

            print(f"\n  结果 {i+1}: {title}...")
            print(f"    距离值: {distance:.6f}")
            print(f"    向量分数: {vector_score:.6f} ({vector_score*100:.2f}%)")
            print(f"    文本分数: {text_score:.6f} ({text_score*100:.2f}%)")
            print(f"    融合分数: {fusion_score:.6f} ({fusion_score*100:.2f}%)")
            print(f"    重排序分数: {rerank_score:.6f}")
            print(f"    最终分数: {final_score:.6f}")

            # 验证距离到向量分数的转换
            if distance != 0:
                expected_vector_score = math.exp(-abs(distance))
                print(f"    预期向量分数: {expected_vector_score:.6f} (基于距离 {distance:.6f})")
                if abs(vector_score - expected_vector_score) > 0.001:
                    print(f"    ⚠️  向量分数计算可能有误!")

            # 验证融合分数计算
            expected_fusion = 0.6 * vector_score + 0.4 * text_score
            print(f"    预期融合分数: {expected_fusion:.6f}")
            if abs(fusion_score - expected_fusion) > 0.001:
                print(f"    ⚠️  融合分数计算可能有误!")

        return data

    except requests.exceptions.RequestException as e:
        print(f"❌ 网络错误: {e}")
        return {"error": str(e)}
    except Exception as e:
        print(f"❌ 未知错误: {e}")
        return {"error": str(e)}

def test_distance_calculation():
    """测试距离到相似度的转换函数"""
    print("\n🧪 测试距离转换函数:")

    test_distances = [
        (0, "完全匹配"),
        (-1, "负距离-1"),
        (-4.62, "你的实际数据"),
        (-6.70, "你之前的数据"),
        (1.0, "正距离1.0"),
        (2.0, "正距离2.0"),
        (5.0, "较大正距离")
    ]

    for distance, desc in test_distances:
        if distance == 0:
            similarity = 1.0
        elif distance == float('inf'):
            similarity = 0.0
        else:
            similarity = math.exp(-abs(distance))

        print(f"  距离 {distance:6.2f} ({desc:12}) → 相似度 {similarity:.6f} ({similarity*100:.2f}%)")

def run_comprehensive_test():
    """运行综合测试"""
    print("=" * 60)
    print("🚀 搜索评分诊断测试")
    print("=" * 60)

    # 1. 测试距离计算函数
    test_distance_calculation()

    # 2. 测试不同相关性的查询
    test_queries = [
        ("数列", "高相关性 - 直接匹配知识点"),
        ("前n项和", "高相关性 - 核心概念"),
        ("通项公式", "高相关性 - 核心概念"),
        ("微积分", "低相关性 - 不相关主题"),
        ("编程", "低相关性 - 完全无关"),
        ("asdfghjkl", "无相关性 - 随机字符"),
        ("", "空查询"),
        ("数学 概念 基础", "中等相关性 - 相关但不精确"),
    ]

    results_summary = []

    for query, expected in test_queries:
        result = test_search_query(query, expected)
        if "error" not in result and result.get("results"):
            first_result = result["results"][0]
            fusion_score = first_result.get("fusion_score", 0)
            results_summary.append((query, fusion_score * 100, expected))

    # 3. 汇总分析
    print("\n" + "=" * 60)
    print("📈 结果汇总分析")
    print("=" * 60)

    if results_summary:
        print(f"{'查询':<15} {'匹配度':<10} {'预期相关性'}")
        print("-" * 50)
        for query, score, expected in results_summary:
            print(f"{query:<15} {score:6.2f}%   {expected}")

        # 检查分数分布
        scores = [score for _, score, _ in results_summary]
        avg_score = sum(scores) / len(scores)
        min_score = min(scores)
        max_score = max(scores)

        print(f"\n统计信息:")
        print(f"  平均匹配度: {avg_score:.2f}%")
        print(f"  最低匹配度: {min_score:.2f}%")
        print(f"  最高匹配度: {max_score:.2f}%")
        print(f"  分数范围: {max_score - min_score:.2f}%")

        # 分析问题
        if max_score - min_score < 20:
            print("⚠️  警告: 分数变化范围太小，可能存在计算问题!")

        if min_score > 30:
            print("⚠️  警告: 即使不相关查询也有高分，可能存在基准分数问题!")

        if avg_score > 60:
            print("⚠️  警告: 平均分数过高，评分可能不够严格!")

if __name__ == "__main__":
    run_comprehensive_test()