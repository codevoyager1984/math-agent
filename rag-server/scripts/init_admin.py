#!/usr/bin/env python3
"""
初始化管理员用户脚本
"""
import asyncio
import sys
import os

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.admin_user import AdminUserRepository


async def create_default_admin():
    """创建默认管理员用户"""
    print("🔧 正在创建默认管理员用户...")

    admin_user_repository = AdminUserRepository()
    
    try:
        # 创建默认管理员用户
        admin_user = await admin_user_repository.create_admin_user(
            username="admin",
            password="admin123",
            email="admin@mathagent.com",
            is_superuser=True
        )
        
        if admin_user:
            print(f"✅ 默认管理员用户创建成功:")
            print(f"   用户名: admin")
            print(f"   密码: admin123")
            print(f"   邮箱: admin@mathagent.com")
            print(f"   用户ID: {admin_user.id}")
        else:
            print("❌ 默认管理员用户创建失败 (可能已存在)")
        
        # 显示所有用户
        print("\n📋 当前所有管理员用户:")
        all_users = await admin_user_repository.get_all_admin_users()
        for user in all_users:
            status = "✅ 激活" if user.is_active else "❌ 禁用"
            super_status = "👑 超级用户" if user.is_superuser else "👤 普通用户"
            print(f"   ID: {user.id}, 用户名: {user.username}, 邮箱: {user.email}, {status}, {super_status}")
        
        print(f"\n📊 总计: {len(all_users)} 个管理员用户")
        
    except Exception as e:
        print(f"❌ 创建管理员用户时发生错误: {e}")
        return False
    
    return True


async def main():
    """主函数"""
    print("🚀 Math Agent RAG 服务 - 管理员用户初始化")
    print("=" * 50)
    
    success = await create_default_admin()
    
    if success:
        print("\n✅ 初始化完成!")
        print("\n💡 提示:")
        print("   - 请妥善保管管理员账号信息")
        print("   - 建议在生产环境中修改默认密码")
        print("   - 可以通过 /api/admin/login 接口进行登录测试")
    else:
        print("\n❌ 初始化失败!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
