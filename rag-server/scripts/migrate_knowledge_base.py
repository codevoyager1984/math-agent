#!/usr/bin/env python3
"""
知识库数据迁移脚本
支持从一个服务的知识库迁移数据到另一个服务
"""
import asyncio
import sys
import os
import argparse
import aiohttp
import json
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class KnowledgeMigrator:
    """知识库迁移器"""
    
    def __init__(self, source_url: str, target_url: str):
        """
        初始化迁移器
        
        Args:
            source_url: 源服务的基础URL
            target_url: 目标服务的基础URL
        """
        self.source_url = source_url.rstrip('/')
        self.target_url = target_url.rstrip('/')
        self.session = None
        
    async def __aenter__(self):
        """异步上下文管理器入口"""
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        if self.session:
            await self.session.close()
    
    async def fetch_all_knowledge_points(self) -> List[Dict[str, Any]]:
        """
        从源服务获取所有知识点
        
        Returns:
            所有知识点的列表
        """
        all_knowledge_points = []
        page = 1
        limit = 100  # 每页获取更多数据以减少请求次数
        
        print(f"📡 开始从源服务获取知识点数据: {self.source_url}")
        
        while True:
            try:
                # 构建请求URL
                url = urljoin(self.source_url, "/api/knowledge-base/documents")
                params = {
                    "page": page,
                    "limit": limit
                }
                
                print(f"   正在获取第 {page} 页数据...")
                
                async with self.session.get(url, params=params) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"获取数据失败 (状态码: {response.status}): {error_text}")
                    
                    data = await response.json()
                    
                    # 检查响应格式
                    if "knowledge_points" not in data:
                        raise Exception(f"响应格式错误，缺少 knowledge_points 字段: {data}")
                    
                    knowledge_points = data["knowledge_points"]
                    total = data.get("total", 0)
                    
                    if not knowledge_points:
                        print(f"   第 {page} 页没有更多数据，停止获取")
                        break
                    
                    all_knowledge_points.extend(knowledge_points)
                    print(f"   ✅ 获取到 {len(knowledge_points)} 个知识点 (总计: {len(all_knowledge_points)}/{total})")
                    
                    # 如果当前页的数据量小于limit，说明已经是最后一页
                    if len(knowledge_points) < limit:
                        print(f"   已获取完所有数据")
                        break
                    
                    page += 1
                    
            except Exception as e:
                print(f"❌ 获取第 {page} 页数据时发生错误: {e}")
                raise
        
        print(f"🎉 成功获取 {len(all_knowledge_points)} 个知识点")
        return all_knowledge_points
    
    def convert_knowledge_point_format(self, knowledge_point: Dict[str, Any]) -> Dict[str, Any]:
        """
        转换知识点格式以适配目标服务的批量添加接口
        
        Args:
            knowledge_point: 源格式的知识点
            
        Returns:
            转换后的知识点格式
        """
        # 转换例题格式
        examples = []
        for example in knowledge_point.get("examples", []):
            if isinstance(example, dict):
                examples.append({
                    "question": example.get("question", ""),
                    "solution": example.get("solution", ""),
                    "difficulty": example.get("difficulty", "medium")
                })
        
        # 构建目标格式
        converted = {
            "title": knowledge_point.get("title", ""),
            "description": knowledge_point.get("description", ""),
            "category": knowledge_point.get("category", "general"),
            "examples": examples,
            "tags": knowledge_point.get("tags", [])
        }
        
        return converted
    
    async def batch_migrate_knowledge_points(self, knowledge_points: List[Dict[str, Any]], batch_size: int = 50) -> Dict[str, Any]:
        """
        批量迁移知识点到目标服务
        
        Args:
            knowledge_points: 知识点列表
            batch_size: 每批次的大小
            
        Returns:
            迁移结果统计
        """
        print(f"📤 开始向目标服务迁移数据: {self.target_url}")
        print(f"   总共 {len(knowledge_points)} 个知识点，每批次 {batch_size} 个")
        
        total_success = 0
        total_failed = 0
        all_errors = []
        
        # 分批处理
        for i in range(0, len(knowledge_points), batch_size):
            batch = knowledge_points[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(knowledge_points) + batch_size - 1) // batch_size
            
            print(f"   正在处理第 {batch_num}/{total_batches} 批...")
            
            try:
                # 转换格式
                converted_batch = [self.convert_knowledge_point_format(kp) for kp in batch]
                
                # 构建请求数据
                request_data = {
                    "knowledge_points": converted_batch
                }
                
                # 发送批量添加请求
                url = urljoin(self.target_url, "/api/knowledge-base/batch-documents")
                
                async with self.session.post(url, json=request_data) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(f"批量添加失败 (状态码: {response.status}): {error_text}")
                    
                    result = await response.json()
                    
                    batch_success = result.get("success_count", 0)
                    batch_failed = result.get("failed_count", 0)
                    batch_errors = result.get("errors", [])
                    
                    total_success += batch_success
                    total_failed += batch_failed
                    all_errors.extend(batch_errors)
                    
                    print(f"   ✅ 第 {batch_num} 批完成: 成功 {batch_success}, 失败 {batch_failed}")
                    
                    if batch_errors:
                        print(f"      错误信息: {batch_errors[:3]}{'...' if len(batch_errors) > 3 else ''}")
                
            except Exception as e:
                print(f"❌ 第 {batch_num} 批处理失败: {e}")
                total_failed += len(batch)
                all_errors.append(f"第 {batch_num} 批整体失败: {str(e)}")
        
        return {
            "total_success": total_success,
            "total_failed": total_failed,
            "total_processed": len(knowledge_points),
            "errors": all_errors
        }
    
    async def migrate(self, batch_size: int = 50) -> bool:
        """
        执行完整的迁移流程
        
        Args:
            batch_size: 批量处理的大小
            
        Returns:
            是否迁移成功
        """
        try:
            # 1. 获取源数据
            knowledge_points = await self.fetch_all_knowledge_points()
            
            if not knowledge_points:
                print("⚠️  源服务中没有找到知识点数据")
                return True
            
            # 2. 迁移数据
            result = await self.batch_migrate_knowledge_points(knowledge_points, batch_size)
            
            # 3. 输出结果
            print(f"\n📊 迁移完成统计:")
            print(f"   总处理数量: {result['total_processed']}")
            print(f"   成功数量: {result['total_success']}")
            print(f"   失败数量: {result['total_failed']}")
            print(f"   成功率: {result['total_success'] / result['total_processed'] * 100:.1f}%")
            
            if result['errors']:
                print(f"\n❌ 错误信息 (前10个):")
                for i, error in enumerate(result['errors'][:10]):
                    print(f"   {i+1}. {error}")
                if len(result['errors']) > 10:
                    print(f"   ... 还有 {len(result['errors']) - 10} 个错误")
            
            return result['total_failed'] == 0
            
        except Exception as e:
            print(f"💥 迁移过程中发生致命错误: {e}")
            import traceback
            traceback.print_exc()
            return False


def parse_arguments():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="知识库数据迁移工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 基本迁移
  python migrate_knowledge_base.py \\
    --source http://localhost:8001 \\
    --target http://localhost:8002
  
  # 指定批量大小
  python migrate_knowledge_base.py \\
    --source http://source-server:8000 \\
    --target http://target-server:8000 \\
    --batch-size 100
        """
    )
    
    parser.add_argument(
        "--source",
        required=True,
        help="源服务的基础URL (例如: http://localhost:8001)"
    )
    
    parser.add_argument(
        "--target", 
        required=True,
        help="目标服务的基础URL (例如: http://localhost:8002)"
    )
    
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="批量处理的大小 (默认: 50)"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只获取数据不执行迁移，用于测试连接"
    )
    
    return parser.parse_args()


async def main():
    """主函数"""
    args = parse_arguments()
    
    print("🚀 Math Agent 知识库迁移工具")
    print("=" * 50)
    print(f"源服务: {args.source}")
    print(f"目标服务: {args.target}")
    print(f"批量大小: {args.batch_size}")
    print(f"运行模式: {'预览模式' if args.dry_run else '迁移模式'}")
    print("")
    
    try:
        async with KnowledgeMigrator(args.source, args.target) as migrator:
            if args.dry_run:
                # 预览模式：只获取数据
                print("🔍 预览模式：只获取源数据...")
                knowledge_points = await migrator.fetch_all_knowledge_points()
                print(f"\n📋 预览结果:")
                print(f"   发现 {len(knowledge_points)} 个知识点")
                if knowledge_points:
                    sample = knowledge_points[0]
                    print(f"   示例数据: {sample.get('title', 'N/A')} - {sample.get('category', 'N/A')}")
                print("\n✅ 预览完成，可以执行正式迁移")
                success = True
            else:
                # 正式迁移
                success = await migrator.migrate(args.batch_size)
        
        if success:
            print("\n🎉 迁移任务执行成功!")
            if not args.dry_run:
                print("\n💡 建议:")
                print("   - 验证目标服务中的数据完整性")
                print("   - 检查是否有数据丢失或错误")
        else:
            print("\n❌ 迁移任务执行失败!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⏹️  用户中断了迁移过程")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 程序执行过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
