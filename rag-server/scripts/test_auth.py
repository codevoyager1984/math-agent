#!/usr/bin/env python3
"""
测试认证功能脚本
"""
import asyncio
import sys
import os
import json

# 添加项目根目录到路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.auth_service import auth_service
from services.database_service import database_service


async def test_authentication():
    """测试认证功能"""
    print("🧪 测试管理员认证功能")
    print("=" * 50)
    
    # 测试用户认证
    print("\n1. 测试用户认证...")
    
    # 测试正确的用户名和密码
    user = await auth_service.authenticate_user("admin", "admin123")
    if user:
        print(f"✅ 用户认证成功: {user.username}")
    else:
        print("❌ 用户认证失败")
        return False
    
    # 测试错误的密码
    user = await auth_service.authenticate_user("admin", "wrongpassword")
    if not user:
        print("✅ 错误密码认证失败 (正确行为)")
    else:
        print("❌ 错误密码认证成功 (异常行为)")
        return False
    
    # 测试不存在的用户
    user = await auth_service.authenticate_user("nonexistent", "password")
    if not user:
        print("✅ 不存在用户认证失败 (正确行为)")
    else:
        print("❌ 不存在用户认证成功 (异常行为)")
        return False
    
    # 测试登录功能
    print("\n2. 测试登录功能...")
    login_response = await auth_service.login("admin", "admin123")
    if login_response:
        print(f"✅ 登录成功, 令牌: {login_response.access_token[:20]}...")
        access_token = login_response.access_token
    else:
        print("❌ 登录失败")
        return False
    
    # 测试令牌验证
    print("\n3. 测试令牌验证...")
    verified_user = await auth_service.verify_token(access_token)
    if verified_user:
        print(f"✅ 令牌验证成功: {verified_user.username}")
    else:
        print("❌ 令牌验证失败")
        return False
    
    # 测试无效令牌
    invalid_token = "invalid_token_12345"
    verified_user = await auth_service.verify_token(invalid_token)
    if not verified_user:
        print("✅ 无效令牌验证失败 (正确行为)")
    else:
        print("❌ 无效令牌验证成功 (异常行为)")
        return False
    
    # 测试服务信息
    print("\n4. 测试服务信息...")
    service_info = await auth_service.get_service_info()
    print(f"✅ 服务信息: {json.dumps(service_info, indent=2, ensure_ascii=False)}")
    
    # 测试数据库用户查询
    print("\n5. 测试数据库用户查询...")
    all_users = await database_service.get_all_admin_users()
    print(f"✅ 数据库中共有 {len(all_users)} 个管理员用户:")
    for user in all_users:
        print(f"   - ID: {user.id}, 用户名: {user.username}, 邮箱: {user.email}")
    
    return True


async def main():
    """主函数"""
    try:
        success = await test_authentication()
        
        if success:
            print("\n🎉 所有测试通过!")
            print("\n💡 提示:")
            print("   - 认证功能工作正常")
            print("   - 可以开始使用 /api/admin/login 接口")
            print("   - 默认管理员账号: admin / admin123")
        else:
            print("\n❌ 测试失败!")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
