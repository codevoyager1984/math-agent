#!/usr/bin/env python3
"""
ChromaDB 向量导出脚本
从 ChromaDB 中拉取所有向量数据，包括文档内容、元数据等信息（不包含向量嵌入）
"""
import asyncio
import sys
import os
import argparse
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

# 添加项目根目录到路径
sys.path.append('.')

import chromadb
from loguru import logger


class VectorExporter:
    """向量导出器"""
    
    def __init__(self, host: str = "localhost", port: int = 8000):
        """
        初始化向量导出器
        
        Args:
            host: ChromaDB 服务器地址
            port: ChromaDB 服务器端口
        """
        self.host = host
        self.port = port
        self._client = None
        
    async def _get_client(self):
        """获取或创建 ChromaDB 客户端"""
        if self._client is None:
            try:
                self._client = await chromadb.AsyncHttpClient(
                    host=self.host, 
                    port=self.port
                )
                logger.info(f"已连接到 ChromaDB: {self.host}:{self.port}")
            except Exception as e:
                logger.error(f"连接 ChromaDB 失败: {e}")
                raise
        return self._client
    
    async def list_collections(self) -> List[str]:
        """
        列出所有集合
        
        Returns:
            集合名称列表
        """
        try:
            client = await self._get_client()
            collections = await client.list_collections()
            collection_names = [col.name for col in collections]
            logger.info(f"发现 {len(collection_names)} 个集合: {collection_names}")
            return collection_names
            
        except Exception as e:
            logger.error(f"列出集合失败: {e}")
            raise
    
    async def get_collection_info(self, collection_name: str) -> Dict[str, Any]:
        """
        获取集合信息
        
        Args:
            collection_name: 集合名称
            
        Returns:
            集合信息
        """
        try:
            client = await self._get_client()
            collection = await client.get_collection(collection_name)
            count = await collection.count()
            
            return {
                "name": collection_name,
                "count": count
            }
            
        except Exception as e:
            logger.error(f"获取集合 {collection_name} 信息失败: {e}")
            raise
    
    async def export_collection_vectors(
        self, 
        collection_name: str, 
        batch_size: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        导出集合中的所有向量数据
        
        Args:
            collection_name: 集合名称
            batch_size: 批处理大小
            
        Returns:
            向量数据列表，包含完整的文档信息（除向量嵌入外）
        """
        try:
            client = await self._get_client()
            collection = await client.get_collection(collection_name)
            
            logger.info(f"开始导出集合 {collection_name} 的向量数据...")
            
            # 获取集合中的文档总数
            total_count = await collection.count()
            logger.info(f"集合 {collection_name} 共有 {total_count} 个文档")
            
            if total_count == 0:
                logger.warning(f"集合 {collection_name} 为空")
                return []
            
            all_vectors = []
            
            # 分批获取数据以避免内存问题
            offset = 0
            while offset < total_count:
                try:
                    # 计算当前批次的大小
                    current_batch_size = min(batch_size, total_count - offset)
                    
                    logger.info(f"正在获取第 {offset + 1}-{offset + current_batch_size} 个文档...")
                    
                    # 获取当前批次的数据
                    results = await collection.get(
                        limit=current_batch_size,
                        offset=offset,
                        include=["documents", "metadatas"]
                    )
                    
                    if not results or not results.get('ids'):
                        logger.warning(f"批次 {offset}-{offset + current_batch_size} 没有返回数据")
                        break
                    
                    # 处理当前批次的数据
                    ids = results.get('ids', [])
                    documents = results.get('documents', [])
                    metadatas = results.get('metadatas', [])
                    
                    batch_vectors = []
                    for i, doc_id in enumerate(ids):
                        # 获取文档内容
                        content = documents[i] if i < len(documents) else ""
                        
                        # 获取元数据
                        metadata = metadatas[i] if i < len(metadatas) and metadatas[i] else {}
                        
                        # 提取标题信息（用于显示）
                        title = "未知标题"
                        if metadata:
                            # 尝试多种可能的标题字段名
                            title_fields = ['title', 'name', 'filename', 'subject', 'topic']
                            for field in title_fields:
                                if field in metadata and metadata[field]:
                                    title = metadata[field]
                                    break
                        
                        # 如果 metadata 中没有标题，尝试从文档内容中提取
                        if title == "未知标题" and content:
                            # 取文档内容的前50个字符作为标题
                            if content.strip():
                                title = content.strip()[:50]
                                if len(content.strip()) > 50:
                                    title += "..."
                        
                        # 构建完整的向量数据
                        vector_data = {
                            "id": doc_id,
                            "title": title,  # 用于显示的标题
                            "content": content,  # 完整文档内容
                            "metadata": metadata,  # 完整元数据
                            "content_length": len(content) if content else 0,  # 内容长度
                            "metadata_keys": list(metadata.keys()) if metadata else []  # 元数据字段列表
                        }
                        batch_vectors.append(vector_data)
                    
                    all_vectors.extend(batch_vectors)
                    logger.info(f"✅ 成功处理 {len(batch_vectors)} 个向量 (总计: {len(all_vectors)}/{total_count})")
                    
                    offset += current_batch_size
                    
                except Exception as e:
                    logger.error(f"处理批次 {offset}-{offset + current_batch_size} 时发生错误: {e}")
                    # 继续处理下一批次
                    offset += batch_size
                    continue
            
            logger.info(f"🎉 成功导出集合 {collection_name} 的 {len(all_vectors)} 个向量")
            return all_vectors
            
        except Exception as e:
            logger.error(f"导出集合 {collection_name} 向量失败: {e}")
            raise
    
    async def export_all_vectors(
        self, 
        collection_names: Optional[List[str]] = None,
        batch_size: int = 1000
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        导出所有集合的向量数据
        
        Args:
            collection_names: 要导出的集合名称列表，如果为 None 则导出所有集合
            batch_size: 批处理大小
            
        Returns:
            按集合名称分组的向量数据
        """
        try:
            # 如果没有指定集合，获取所有集合
            if collection_names is None:
                collection_names = await self.list_collections()
            
            if not collection_names:
                logger.warning("没有找到任何集合")
                return {}
            
            all_results = {}
            
            for collection_name in collection_names:
                try:
                    logger.info(f"📊 开始处理集合: {collection_name}")
                    
                    # 获取集合信息
                    info = await self.get_collection_info(collection_name)
                    logger.info(f"集合 {collection_name} 包含 {info['count']} 个文档")
                    
                    # 导出向量信息
                    vectors = await self.export_collection_vectors(collection_name, batch_size)
                    all_results[collection_name] = vectors
                    
                    logger.info(f"✅ 集合 {collection_name} 导出完成，共 {len(vectors)} 个向量")
                    
                except Exception as e:
                    logger.error(f"❌ 处理集合 {collection_name} 失败: {e}")
                    all_results[collection_name] = []
                    continue
            
            return all_results
            
        except Exception as e:
            logger.error(f"导出所有向量失败: {e}")
            raise
    
    async def close(self):
        """关闭连接"""
        if self._client:
            # ChromaDB 客户端通常不需要显式关闭
            self._client = None


def format_output(results: Dict[str, List[Dict[str, Any]]], output_format: str = "table") -> str:
    """
    格式化输出结果
    
    Args:
        results: 导出结果
        output_format: 输出格式 (table, json, csv, summary)
        
    Returns:
        格式化后的字符串
    """
    if output_format == "json":
        return json.dumps(results, ensure_ascii=False, indent=2)
    
    elif output_format == "csv":
        lines = ["Collection,ID,Title,Content_Length,Metadata_Keys,Content,Metadata"]
        for collection_name, vectors in results.items():
            for vector in vectors:
                # CSV 格式需要处理特殊字符
                title = vector['title'].replace('"', '""').replace('\n', ' ').replace('\r', ' ')
                content = vector['content'].replace('"', '""').replace('\n', '\\n').replace('\r', '\\r')
                metadata_keys = '|'.join(vector.get('metadata_keys', []))
                metadata_json = json.dumps(vector.get('metadata', {}), ensure_ascii=False).replace('"', '""')
                
                lines.append(f'"{collection_name}","{vector["id"]}","{title}","{vector.get("content_length", 0)}","{metadata_keys}","{content}","{metadata_json}"')
        return '\n'.join(lines)
    
    elif output_format == "summary":
        # 摘要格式：只显示统计信息和基本字段
        output_lines = []
        total_vectors = 0
        
        for collection_name, vectors in results.items():
            output_lines.append(f"\n📚 集合: {collection_name}")
            output_lines.append("=" * 100)
            
            if not vectors:
                output_lines.append("   (空集合)")
                continue
            
            output_lines.append(f"{'序号':<6} {'ID':<36} {'标题':<30} {'内容长度':<10} {'元数据字段'}")
            output_lines.append("-" * 100)
            
            for i, vector in enumerate(vectors, 1):
                # 限制标题长度以适应表格显示
                title = vector['title'][:27] + "..." if len(vector['title']) > 27 else vector['title']
                metadata_keys = ', '.join(vector.get('metadata_keys', []))[:20]
                if len(', '.join(vector.get('metadata_keys', []))) > 20:
                    metadata_keys += "..."
                
                output_lines.append(f"{i:<6} {vector['id']:<36} {title:<30} {vector.get('content_length', 0):<10} {metadata_keys}")
            
            output_lines.append(f"\n小计: {len(vectors)} 个向量")
            total_vectors += len(vectors)
        
        output_lines.append(f"\n🎉 总计: {total_vectors} 个向量")
        return '\n'.join(output_lines)
    
    else:  # table format - 详细格式
        output_lines = []
        total_vectors = 0
        
        for collection_name, vectors in results.items():
            output_lines.append(f"\n📚 集合: {collection_name}")
            output_lines.append("=" * 120)
            
            if not vectors:
                output_lines.append("   (空集合)")
                continue
            
            for i, vector in enumerate(vectors, 1):
                output_lines.append(f"\n📄 文档 #{i}")
                output_lines.append("-" * 60)
                output_lines.append(f"ID: {vector['id']}")
                output_lines.append(f"标题: {vector['title']}")
                output_lines.append(f"内容长度: {vector.get('content_length', 0)} 字符")
                
                # 显示元数据
                metadata = vector.get('metadata', {})
                if metadata:
                    output_lines.append("元数据:")
                    for key, value in metadata.items():
                        # 限制值的显示长度
                        if isinstance(value, str) and len(value) > 100:
                            display_value = value[:100] + "..."
                        else:
                            display_value = str(value)
                        output_lines.append(f"  {key}: {display_value}")
                else:
                    output_lines.append("元数据: (无)")
                
                # 显示内容预览
                content = vector.get('content', '')
                if content:
                    preview = content[:200] + "..." if len(content) > 200 else content
                    output_lines.append(f"内容预览: {preview}")
                else:
                    output_lines.append("内容: (空)")
            
            output_lines.append(f"\n小计: {len(vectors)} 个向量")
            total_vectors += len(vectors)
        
        output_lines.append(f"\n🎉 总计: {total_vectors} 个向量")
        return '\n'.join(output_lines)


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="ChromaDB 向量导出工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 导出所有集合的向量数据（摘要格式）
  python export_vectors.py
  
  # 指定 ChromaDB 服务器
  python export_vectors.py --host localhost --port 8000
  
  # 只导出特定集合
  python export_vectors.py --collections math_knowledge
  
  # 详细格式显示完整内容和元数据
  python export_vectors.py --format table
  
  # 输出为 JSON 格式（包含所有数据）
  python export_vectors.py --format json
  
  # 输出为 CSV 格式
  python export_vectors.py --format csv --output vectors.csv
  
  # 摘要格式（默认）
  python export_vectors.py --format summary
        """
    )
    
    parser.add_argument(
        "--host",
        default="localhost",
        help="ChromaDB 服务器地址 (默认: localhost)"
    )
    
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="ChromaDB 服务器端口 (默认: 8000)"
    )
    
    parser.add_argument(
        "--collections",
        nargs="+",
        help="要导出的集合名称列表 (默认: 所有集合)"
    )
    
    parser.add_argument(
        "--format",
        choices=["table", "summary", "json", "csv"],
        default="summary",
        help="输出格式: table(详细), summary(摘要), json(JSON), csv(CSV) (默认: summary)"
    )
    
    parser.add_argument(
        "--output",
        help="输出文件路径 (默认: 输出到控制台)"
    )
    
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="批处理大小 (默认: 1000)"
    )
    
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="静默模式，只输出结果"
    )
    
    return parser.parse_args()


async def main():
    """主函数"""
    args = parse_arguments()
    
    # 配置日志
    if args.quiet:
        logger.remove()
        logger.add(sys.stderr, level="ERROR")
    else:
        logger.remove()
        logger.add(sys.stderr, level="INFO", format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}")
    
    if not args.quiet:
        print("🚀 ChromaDB 向量导出工具")
        print("=" * 50)
        print(f"服务器: {args.host}:{args.port}")
        print(f"集合: {args.collections if args.collections else '所有集合'}")
        print(f"输出格式: {args.format}")
        print(f"批处理大小: {args.batch_size}")
        print("")
    
    try:
        # 创建导出器
        exporter = VectorExporter(host=args.host, port=args.port)
        
        try:
            # 导出向量数据
            results = await exporter.export_all_vectors(
                collection_names=args.collections,
                batch_size=args.batch_size
            )
            
            # 格式化输出
            output_text = format_output(results, args.format)
            
            # 输出结果
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(output_text)
                if not args.quiet:
                    print(f"\n✅ 结果已保存到: {args.output}")
            else:
                print(output_text)
            
            if not args.quiet:
                # 统计信息
                total_collections = len(results)
                total_vectors = sum(len(vectors) for vectors in results.values())
                print(f"\n📊 导出统计:")
                print(f"   集合数量: {total_collections}")
                print(f"   向量总数: {total_vectors}")
                print(f"   完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        finally:
            await exporter.close()
        
        if not args.quiet:
            print("\n🎉 导出完成!")
            
    except KeyboardInterrupt:
        print("\n⏹️  用户中断了导出过程")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 导出过程中发生错误: {e}")
        if not args.quiet:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
