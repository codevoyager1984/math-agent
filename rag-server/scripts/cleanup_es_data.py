#!/usr/bin/env python3
"""
Elasticsearch 数据清理脚本
从 ChromaDB 中获取所有文档 ID，然后删除 Elasticsearch 中不在此列表中的文档
删除前会要求用户确认，确保数据安全
"""
import asyncio
import sys
import os
import argparse
import json
from typing import List, Dict, Any, Set, Optional
from datetime import datetime

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import chromadb
from elasticsearch import AsyncElasticsearch
from loguru import logger


class DataCleanupService:
    """数据清理服务"""
    
    def __init__(
        self, 
        chroma_host: str = "localhost", 
        chroma_port: int = 8000,
        es_host: str = "localhost",
        es_port: int = 9200,
        es_index: str = "math_knowledge"
    ):
        """
        初始化数据清理服务
        
        Args:
            chroma_host: ChromaDB 服务器地址
            chroma_port: ChromaDB 服务器端口
            es_host: Elasticsearch 服务器地址
            es_port: Elasticsearch 服务器端口
            es_index: Elasticsearch 索引名称
        """
        self.chroma_host = chroma_host
        self.chroma_port = chroma_port
        self.es_host = es_host
        self.es_port = es_port
        self.es_index = es_index
        
        self._chroma_client = None
        self._es_client = None
    
    async def _get_chroma_client(self):
        """获取或创建 ChromaDB 客户端"""
        if self._chroma_client is None:
            try:
                self._chroma_client = await chromadb.AsyncHttpClient(
                    host=self.chroma_host, 
                    port=self.chroma_port
                )
                logger.info(f"已连接到 ChromaDB: {self.chroma_host}:{self.chroma_port}")
            except Exception as e:
                logger.error(f"连接 ChromaDB 失败: {e}")
                raise
        return self._chroma_client
    
    async def _get_es_client(self):
        """获取或创建 Elasticsearch 客户端"""
        if self._es_client is None:
            try:
                self._es_client = AsyncElasticsearch(
                    hosts=[{"host": self.es_host, "port": self.es_port, "scheme": "http"}],
                    verify_certs=False,
                    ssl_show_warn=False,
                    request_timeout=30,
                    retry_on_timeout=True,
                    max_retries=3
                )
                # 测试连接
                info = await self._es_client.info()
                logger.info(f"已连接到 Elasticsearch: {self.es_host}:{self.es_port}")
                logger.info(f"ES 版本: {info.get('version', {}).get('number', 'unknown')}")
            except Exception as e:
                logger.error(f"连接 Elasticsearch 失败: {e}")
                raise
        return self._es_client
    
    async def get_chromadb_collections(self) -> List[str]:
        """
        获取 ChromaDB 中的所有集合名称
        
        Returns:
            集合名称列表
        """
        try:
            client = await self._get_chroma_client()
            collections = await client.list_collections()
            collection_names = [col.name for col in collections]
            logger.info(f"发现 ChromaDB 集合: {collection_names}")
            return collection_names
        except Exception as e:
            logger.error(f"获取 ChromaDB 集合失败: {e}")
            raise
    
    async def get_all_chromadb_ids(
        self, 
        collection_names: Optional[List[str]] = None,
        batch_size: int = 1000
    ) -> Set[str]:
        """
        获取 ChromaDB 中所有文档的 ID
        
        Args:
            collection_names: 要检查的集合名称列表，如果为 None 则检查所有集合
            batch_size: 批处理大小
            
        Returns:
            所有文档 ID 的集合
        """
        try:
            client = await self._get_chroma_client()
            
            # 如果没有指定集合，获取所有集合
            if collection_names is None:
                collection_names = await self.get_chromadb_collections()
            
            all_ids = set()
            
            for collection_name in collection_names:
                try:
                    logger.info(f"正在获取集合 {collection_name} 的文档 ID...")
                    
                    collection = await client.get_collection(collection_name)
                    total_count = await collection.count()
                    
                    logger.info(f"集合 {collection_name} 共有 {total_count} 个文档")
                    
                    if total_count == 0:
                        continue
                    
                    # 分批获取 ID
                    offset = 0
                    while offset < total_count:
                        current_batch_size = min(batch_size, total_count - offset)
                        
                        results = await collection.get(
                            limit=current_batch_size,
                            offset=offset,
                            include=[]  # 只获取 ID，不需要其他数据
                        )
                        
                        if not results or not results.get('ids'):
                            break
                        
                        batch_ids = results['ids']
                        all_ids.update(batch_ids)
                        
                        logger.info(f"已获取 {len(batch_ids)} 个 ID (总计: {len(all_ids)})")
                        offset += current_batch_size
                    
                    logger.info(f"✅ 集合 {collection_name} 完成，获取 {len(all_ids)} 个 ID")
                    
                except Exception as e:
                    logger.error(f"获取集合 {collection_name} 的 ID 失败: {e}")
                    continue
            
            logger.info(f"🎉 ChromaDB 总共有 {len(all_ids)} 个唯一文档 ID")
            return all_ids
            
        except Exception as e:
            logger.error(f"获取 ChromaDB 文档 ID 失败: {e}")
            raise
    
    async def get_all_es_ids(self, batch_size: int = 1000) -> Set[str]:
        """
        获取 Elasticsearch 中所有文档的 ID
        
        Args:
            batch_size: 批处理大小
            
        Returns:
            所有文档 ID 的集合
        """
        try:
            es_client = await self._get_es_client()
            
            # 检查索引是否存在
            try:
                exists_response = await es_client.indices.exists(index=self.es_index)
                if not exists_response:
                    logger.warning(f"Elasticsearch 索引 {self.es_index} 不存在")
                    return set()
            except Exception as e:
                logger.error(f"检查索引存在性失败: {e}")
                # 尝试直接搜索，如果索引不存在会返回错误
                pass
            
            logger.info(f"正在获取 Elasticsearch 索引 {self.es_index} 的所有文档 ID...")
            
            all_ids = set()
            
            # 使用 scroll API 获取所有文档 ID
            search_body = {
                "query": {"match_all": {}},
                "_source": False,  # 不需要文档内容，只要 ID
                "size": batch_size
            }
            
            try:
                response = await es_client.search(
                    index=self.es_index,
                    body=search_body,
                    scroll="5m"
                )
            except Exception as e:
                if "index_not_found_exception" in str(e).lower():
                    logger.warning(f"Elasticsearch 索引 {self.es_index} 不存在")
                    return set()
                else:
                    raise
            
            scroll_id = response.get("_scroll_id")
            hits = response["hits"]["hits"]
            
            while hits:
                # 提取当前批次的 ID
                batch_ids = [hit["_id"] for hit in hits]
                all_ids.update(batch_ids)
                
                logger.info(f"已获取 {len(batch_ids)} 个 ID (总计: {len(all_ids)})")
                
                # 获取下一批数据
                if scroll_id:
                    response = await es_client.scroll(
                        scroll_id=scroll_id,
                        scroll="5m"
                    )
                    hits = response["hits"]["hits"]
                else:
                    break
            
            # 清理 scroll
            if scroll_id:
                await es_client.clear_scroll(scroll_id=scroll_id)
            
            logger.info(f"🎉 Elasticsearch 总共有 {len(all_ids)} 个文档 ID")
            return all_ids
            
        except Exception as e:
            logger.error(f"获取 Elasticsearch 文档 ID 失败: {e}")
            raise
    
    async def find_orphaned_es_documents(
        self, 
        collection_names: Optional[List[str]] = None,
        batch_size: int = 1000
    ) -> Set[str]:
        """
        找出 Elasticsearch 中存在但 ChromaDB 中不存在的文档 ID
        
        Args:
            collection_names: 要检查的 ChromaDB 集合名称列表
            batch_size: 批处理大小
            
        Returns:
            需要删除的文档 ID 集合
        """
        try:
            logger.info("🔍 开始查找孤立的 Elasticsearch 文档...")
            
            # 获取 ChromaDB 中的所有 ID
            chroma_ids = await self.get_all_chromadb_ids(collection_names, batch_size)
            
            # 获取 Elasticsearch 中的所有 ID
            es_ids = await self.get_all_es_ids(batch_size)
            
            # 找出差集：在 ES 中但不在 ChromaDB 中的 ID
            orphaned_ids = es_ids - chroma_ids
            
            logger.info(f"📊 数据对比结果:")
            logger.info(f"   ChromaDB 文档数: {len(chroma_ids)}")
            logger.info(f"   Elasticsearch 文档数: {len(es_ids)}")
            logger.info(f"   孤立文档数: {len(orphaned_ids)}")
            
            return orphaned_ids
            
        except Exception as e:
            logger.error(f"查找孤立文档失败: {e}")
            raise
    
    async def delete_es_documents(
        self, 
        document_ids: Set[str], 
        batch_size: int = 100,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        删除 Elasticsearch 中的指定文档
        
        Args:
            document_ids: 要删除的文档 ID 集合
            batch_size: 批处理大小
            dry_run: 是否为试运行模式
            
        Returns:
            删除结果统计
        """
        if not document_ids:
            logger.info("没有需要删除的文档")
            return {"deleted": 0, "failed": 0, "errors": []}
        
        try:
            es_client = await self._get_es_client()
            
            total_docs = len(document_ids)
            deleted_count = 0
            failed_count = 0
            errors = []
            
            if dry_run:
                logger.info(f"🧪 试运行模式：将删除 {total_docs} 个文档")
                return {"deleted": total_docs, "failed": 0, "errors": []}
            
            logger.info(f"🗑️  开始删除 {total_docs} 个文档...")
            
            # 将 ID 列表转换为列表并分批处理
            id_list = list(document_ids)
            
            for i in range(0, len(id_list), batch_size):
                batch_ids = id_list[i:i + batch_size]
                batch_num = i // batch_size + 1
                total_batches = (len(id_list) + batch_size - 1) // batch_size
                
                logger.info(f"正在处理第 {batch_num}/{total_batches} 批 ({len(batch_ids)} 个文档)...")
                
                try:
                    # 构建批量删除请求
                    bulk_body = []
                    for doc_id in batch_ids:
                        bulk_body.append({
                            "delete": {
                                "_index": self.es_index,
                                "_id": doc_id
                            }
                        })
                    
                    # 执行批量删除
                    response = await es_client.bulk(body=bulk_body)
                    
                    # 处理响应
                    if response.get("errors"):
                        for item in response["items"]:
                            delete_result = item.get("delete", {})
                            if delete_result.get("status") in [200, 404]:  # 200=删除成功, 404=文档不存在
                                deleted_count += 1
                            else:
                                failed_count += 1
                                error_msg = delete_result.get("error", {}).get("reason", "未知错误")
                                errors.append(f"删除 {delete_result.get('_id')} 失败: {error_msg}")
                    else:
                        # 没有错误，所有文档都删除成功
                        deleted_count += len(batch_ids)
                    
                    logger.info(f"✅ 第 {batch_num} 批完成 (成功: {deleted_count}, 失败: {failed_count})")
                    
                except Exception as e:
                    logger.error(f"❌ 第 {batch_num} 批删除失败: {e}")
                    failed_count += len(batch_ids)
                    errors.append(f"批次 {batch_num} 整体失败: {str(e)}")
            
            result = {
                "deleted": deleted_count,
                "failed": failed_count,
                "errors": errors
            }
            
            logger.info(f"🎉 删除完成:")
            logger.info(f"   成功删除: {deleted_count}")
            logger.info(f"   删除失败: {failed_count}")
            
            if errors:
                logger.warning(f"   错误数量: {len(errors)}")
                for error in errors[:5]:  # 只显示前5个错误
                    logger.warning(f"     {error}")
                if len(errors) > 5:
                    logger.warning(f"     ... 还有 {len(errors) - 5} 个错误")
            
            return result
            
        except Exception as e:
            logger.error(f"删除 Elasticsearch 文档失败: {e}")
            raise
    
    async def cleanup_orphaned_documents(
        self,
        collection_names: Optional[List[str]] = None,
        batch_size: int = 1000,
        delete_batch_size: int = 100,
        dry_run: bool = False,
        auto_confirm: bool = False
    ) -> Dict[str, Any]:
        """
        清理孤立的 Elasticsearch 文档
        
        Args:
            collection_names: 要检查的 ChromaDB 集合名称列表
            batch_size: 获取数据的批处理大小
            delete_batch_size: 删除操作的批处理大小
            dry_run: 是否为试运行模式
            auto_confirm: 是否自动确认删除
            
        Returns:
            清理结果统计
        """
        try:
            # 1. 查找孤立文档
            orphaned_ids = await self.find_orphaned_es_documents(collection_names, batch_size)
            
            if not orphaned_ids:
                logger.info("✅ 没有发现孤立的文档，数据已同步")
                return {"deleted": 0, "failed": 0, "errors": []}
            
            # 2. 显示要删除的文档信息
            logger.warning(f"⚠️  发现 {len(orphaned_ids)} 个孤立文档需要删除")
            
            # 显示部分 ID 作为示例
            sample_ids = list(orphaned_ids)[:10]
            logger.info("示例文档 ID:")
            for i, doc_id in enumerate(sample_ids, 1):
                logger.info(f"  {i}. {doc_id}")
            if len(orphaned_ids) > 10:
                logger.info(f"  ... 还有 {len(orphaned_ids) - 10} 个文档")
            
            # 3. 确认删除
            if not dry_run and not auto_confirm:
                print(f"\n⚠️  警告：即将删除 {len(orphaned_ids)} 个 Elasticsearch 文档！")
                print("这些文档在 ChromaDB 中不存在，可能是数据不同步导致的。")
                print("删除后无法恢复，请确保这是您想要的操作。")
                
                while True:
                    confirm = input("\n是否继续删除？(yes/no): ").strip().lower()
                    if confirm in ['yes', 'y']:
                        break
                    elif confirm in ['no', 'n']:
                        logger.info("用户取消了删除操作")
                        return {"deleted": 0, "failed": 0, "errors": [], "cancelled": True}
                    else:
                        print("请输入 'yes' 或 'no'")
            
            # 4. 执行删除
            result = await self.delete_es_documents(
                orphaned_ids, 
                delete_batch_size, 
                dry_run
            )
            
            return result
            
        except Exception as e:
            logger.error(f"清理孤立文档失败: {e}")
            raise
    
    async def close(self):
        """关闭连接"""
        if self._chroma_client:
            self._chroma_client = None
        
        if self._es_client:
            await self._es_client.close()
            self._es_client = None


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="Elasticsearch 数据清理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 查找并删除孤立的 ES 文档（需要确认）
  python cleanup_es_data.py
  
  # 试运行模式，只查看不删除
  python cleanup_es_data.py --dry-run
  
  # 自动确认删除，不需要手动确认
  python cleanup_es_data.py --auto-confirm
  
  # 指定服务器地址
  python cleanup_es_data.py --chroma-host localhost --es-host localhost
  
  # 只检查特定的 ChromaDB 集合
  python cleanup_es_data.py --collections math_knowledge
  
  # 指定 ES 索引
  python cleanup_es_data.py --es-index my_knowledge_base
        """
    )
    
    parser.add_argument(
        "--chroma-host",
        default="localhost",
        help="ChromaDB 服务器地址 (默认: localhost)"
    )
    
    parser.add_argument(
        "--chroma-port",
        type=int,
        default=8000,
        help="ChromaDB 服务器端口 (默认: 8000)"
    )
    
    parser.add_argument(
        "--es-host",
        default="localhost",
        help="Elasticsearch 服务器地址 (默认: localhost)"
    )
    
    parser.add_argument(
        "--es-port",
        type=int,
        default=9200,
        help="Elasticsearch 服务器端口 (默认: 9200)"
    )
    
    parser.add_argument(
        "--es-index",
        default="math_knowledge",
        help="Elasticsearch 索引名称 (默认: math_knowledge)"
    )
    
    parser.add_argument(
        "--collections",
        nargs="+",
        help="要检查的 ChromaDB 集合名称列表 (默认: 所有集合)"
    )
    
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="获取数据的批处理大小 (默认: 1000)"
    )
    
    parser.add_argument(
        "--delete-batch-size",
        type=int,
        default=100,
        help="删除操作的批处理大小 (默认: 100)"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="试运行模式，只查看不删除"
    )
    
    parser.add_argument(
        "--auto-confirm",
        action="store_true",
        help="自动确认删除，不需要手动确认"
    )
    
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="静默模式，减少输出"
    )
    
    return parser.parse_args()


async def main():
    """主函数"""
    args = parse_arguments()
    
    # 配置日志
    if args.quiet:
        logger.remove()
        logger.add(sys.stderr, level="WARNING")
    else:
        logger.remove()
        logger.add(sys.stderr, level="INFO", format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | {message}")
    
    if not args.quiet:
        print("🧹 Elasticsearch 数据清理工具")
        print("=" * 50)
        print(f"ChromaDB: {args.chroma_host}:{args.chroma_port}")
        print(f"Elasticsearch: {args.es_host}:{args.es_port}")
        print(f"ES 索引: {args.es_index}")
        print(f"集合: {args.collections if args.collections else '所有集合'}")
        print(f"模式: {'试运行' if args.dry_run else '正式清理'}")
        print(f"批处理大小: {args.batch_size}")
        print("")
    
    try:
        # 创建清理服务
        cleanup_service = DataCleanupService(
            chroma_host=args.chroma_host,
            chroma_port=args.chroma_port,
            es_host=args.es_host,
            es_port=args.es_port,
            es_index=args.es_index
        )
        
        try:
            # 执行清理
            result = await cleanup_service.cleanup_orphaned_documents(
                collection_names=args.collections,
                batch_size=args.batch_size,
                delete_batch_size=args.delete_batch_size,
                dry_run=args.dry_run,
                auto_confirm=args.auto_confirm
            )
            
            if not args.quiet:
                print(f"\n📊 清理结果:")
                if result.get("cancelled"):
                    print("   操作已取消")
                else:
                    print(f"   删除成功: {result.get('deleted', 0)}")
                    print(f"   删除失败: {result.get('failed', 0)}")
                    if result.get('errors'):
                        print(f"   错误数量: {len(result['errors'])}")
                print(f"   完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        finally:
            await cleanup_service.close()
        
        if not args.quiet:
            if args.dry_run:
                print("\n🧪 试运行完成！要执行实际删除，请移除 --dry-run 参数")
            else:
                print("\n🎉 清理完成！")
            
    except KeyboardInterrupt:
        print("\n⏹️  用户中断了清理过程")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 清理过程中发生错误: {e}")
        if not args.quiet:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
