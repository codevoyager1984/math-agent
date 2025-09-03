#!/usr/bin/env python3
"""
测试管理员认证接口的客户端
"""
import asyncio
import aiohttp
import json


async def test_admin_auth():
    """测试管理员认证接口"""
    base_url = "http://localhost:8000/api"
    
    async with aiohttp.ClientSession() as session:
        print("🧪 测试管理员认证接口")
        print("=" * 50)
        
        # 1. 测试登录接口
        print("\n1. 测试管理员登录...")
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        async with session.post(f"{base_url}/admin/login", json=login_data) as response:
            if response.status == 200:
                login_response = await response.json()
                access_token = login_response["access_token"]
                user_info = login_response["user"]
                
                print(f"✅ 登录成功!")
                print(f"   访问令牌: {access_token[:20]}...")
                print(f"   用户信息: {json.dumps(user_info, indent=2, ensure_ascii=False)}")
            else:
                error_text = await response.text()
                print(f"❌ 登录失败: {response.status} - {error_text}")
                return
        
        # 2. 测试获取个人信息接口
        print("\n2. 测试获取管理员个人信息...")
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with session.get(f"{base_url}/admin/profile", headers=headers) as response:
            if response.status == 200:
                profile_response = await response.json()
                print(f"✅ 获取个人信息成功!")
                print(f"   个人信息: {json.dumps(profile_response, indent=2, ensure_ascii=False)}")
            else:
                error_text = await response.text()
                print(f"❌ 获取个人信息失败: {response.status} - {error_text}")
        
        # 3. 测试认证服务状态接口
        print("\n3. 测试认证服务状态...")
        async with session.get(f"{base_url}/admin/status") as response:
            if response.status == 200:
                status_response = await response.json()
                print(f"✅ 获取服务状态成功!")
                print(f"   服务状态: {json.dumps(status_response, indent=2, ensure_ascii=False)}")
            else:
                error_text = await response.text()
                print(f"❌ 获取服务状态失败: {response.status} - {error_text}")
        
        # 4. 测试无效令牌
        print("\n4. 测试无效令牌...")
        invalid_headers = {"Authorization": "Bearer invalid_token_123"}
        
        async with session.get(f"{base_url}/admin/profile", headers=invalid_headers) as response:
            if response.status == 401:
                print("✅ 无效令牌被正确拒绝!")
            else:
                print(f"❌ 无效令牌未被拒绝: {response.status}")
        
        # 5. 测试错误的登录凭据
        print("\n5. 测试错误的登录凭据...")
        wrong_login_data = {
            "username": "admin",
            "password": "wrongpassword"
        }
        
        async with session.post(f"{base_url}/admin/login", json=wrong_login_data) as response:
            if response.status == 401:
                print("✅ 错误凭据被正确拒绝!")
            else:
                error_text = await response.text()
                print(f"❌ 错误凭据未被拒绝: {response.status} - {error_text}")
        
        # 6. 测试登出接口
        print("\n6. 测试管理员登出...")
        async with session.post(f"{base_url}/admin/logout", headers=headers) as response:
            if response.status == 200:
                logout_response = await response.json()
                print(f"✅ 登出成功!")
                print(f"   响应: {json.dumps(logout_response, indent=2, ensure_ascii=False)}")
            else:
                error_text = await response.text()
                print(f"❌ 登出失败: {response.status} - {error_text}")


async def main():
    """主函数"""
    try:
        await test_admin_auth()
        print("\n🎉 所有接口测试完成!")
        print("\n💡 提示:")
        print("   - 如果看到错误，请确保:")
        print("     1. RAG 服务正在运行 (python main.py)")
        print("     2. 数据库已正确配置")
        print("     3. 已运行初始化脚本创建管理员用户")
        
    except aiohttp.ClientError as e:
        print(f"\n❌ 网络连接错误: {e}")
        print("   请确保 RAG 服务正在 http://localhost:8000 上运行")
    except Exception as e:
        print(f"\n💥 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
