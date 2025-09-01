#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
OpenRouter GPT-4O 图片文字识别示例代码
使用 OpenRouter 的 GPT-4O 模型来识别图片中的文字和数学公式
"""

import requests
import base64
import json
import os
import sys
from typing import Optional, Dict, Any


class OpenRouterOCR:
    def __init__(self, api_key: str):
        """
        初始化 OpenRouter OCR 客户端
        
        Args:
            api_key: OpenRouter API Key
        """
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "openai/gpt-5"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
    
    def encode_image(self, image_path: str) -> Optional[str]:
        """
        将图片文件编码为 base64 字符串
        
        Args:
            image_path: 图片文件路径
            
        Returns:
            base64 编码的图片字符串，如果失败返回 None
        """
        try:
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                return encoded_string
        except Exception as e:
            print(f"❌ 编码图片失败: {e}")
            return None
    
    def get_image_mime_type(self, image_path: str) -> str:
        """
        根据文件扩展名获取 MIME 类型
        
        Args:
            image_path: 图片文件路径
            
        Returns:
            MIME 类型字符串
        """
        extension = os.path.splitext(image_path)[1].lower()
        mime_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return mime_types.get(extension, 'image/jpeg')
    
    def recognize_text(self, image_path: str, custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        识别图片中的文字
        
        Args:
            image_path: 图片文件路径
            custom_prompt: 自定义提示词，如果为空则使用默认提示
            
        Returns:
            包含识别结果的字典
        """
        # 检查文件是否存在
        if not os.path.exists(image_path):
            return {"error": f"图片文件不存在: {image_path}"}
        
        # 编码图片
        base64_image = self.encode_image(image_path)
        if not base64_image:
            return {"error": "图片编码失败"}
        
        # 获取图片 MIME 类型
        mime_type = self.get_image_mime_type(image_path)
        
        # 默认提示词
        default_prompt = """请识别下图片里面的主体内容，请直接返回完整的内容，不需要做过多解释。"""
        
        prompt = custom_prompt if custom_prompt else default_prompt
        
        # 构建请求数据
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}",
                                "detail": "high"  # 使用高精度模式
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 2000,
            "temperature": 0.1  # 低温度确保输出稳定
        }
        
        try:
            print(f"🚀 正在使用 GPT-4O 识别图片: {image_path}")
            print("⏳ 请稍等...")
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if 'choices' in result and len(result['choices']) > 0:
                    content = result['choices'][0]['message']['content']

                    print(f"识别结果: {content}")
                    
                    return {
                        "success": True,
                        "text": content,
                        "model": result.get('model', self.model),
                        "usage": result.get('usage', {}),
                        "raw_response": result
                    }
                else:
                    return {"error": "API 响应中没有找到内容"}
            else:
                error_msg = f"API 请求失败: {response.status_code}"
                try:
                    error_detail = response.json()
                    if 'error' in error_detail:
                        error_msg += f" - {error_detail['error'].get('message', '')}"
                except:
                    error_msg += f" - {response.text}"
                
                return {"error": error_msg}
                
        except requests.exceptions.Timeout:
            return {"error": "请求超时，请重试"}
        except Exception as e:
            return {"error": f"请求异常: {str(e)}"}
    
    def batch_recognize(self, image_paths: list, custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        批量识别多张图片
        
        Args:
            image_paths: 图片文件路径列表
            custom_prompt: 自定义提示词
            
        Returns:
            包含所有识别结果的字典
        """
        results = {}
        total = len(image_paths)
        
        print(f"🔄 开始批量识别 {total} 张图片...")
        
        for i, image_path in enumerate(image_paths, 1):
            print(f"\n📷 处理第 {i}/{total} 张图片: {image_path}")
            result = self.recognize_text(image_path, custom_prompt)
            results[image_path] = result
            
            if result.get("success"):
                print("✅ 识别成功")
            else:
                print(f"❌ 识别失败: {result.get('error', '未知错误')}")
        
        return results


def main():
    """主函数，演示如何使用 OpenRouter OCR"""
    
    # 从环境变量或直接配置获取 API Key
    API_KEY = os.getenv("OPENAI_API_KEY", "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")
    
    if not API_KEY or API_KEY == "sk-or-v1-your-api-key-here":
        print("❌ 请设置有效的 OPENAI_API_KEY 环境变量或在代码中配置 API Key")
        print("💡 使用方法:")
        print("   export OPENAI_API_KEY=sk-or-v1-your-actual-api-key")
        print("   或者直接在代码中修改 API_KEY 变量")
        return
    
    # 初始化 OCR 客户端
    ocr = OpenRouterOCR(API_KEY)
    
    # 支持命令行参数
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        
        # 检查是否是批量处理
        if image_path == "batch":
            # 批量处理 itr 目录下的所有图片
            itr_dir = "itr"
            if os.path.exists(itr_dir):
                image_files = []
                for file in os.listdir(itr_dir):
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                        image_files.append(os.path.join(itr_dir, file))
                
                if image_files:
                    results = ocr.batch_recognize(image_files)
                    
                    print("\n" + "="*60)
                    print("📊 批量识别结果汇总:")
                    print("="*60)
                    
                    for img_path, result in results.items():
                        print(f"\n📸 {img_path}:")
                        if result.get("success"):
                            print("✅ 识别成功")
                            print("📝 识别内容:")
                            print("-" * 40)
                            print(result["text"])
                            print("-" * 40)
                            
                            usage = result.get("usage", {})
                            if usage:
                                print(f"💰 Token 使用: 输入={usage.get('prompt_tokens', 0)}, 输出={usage.get('completion_tokens', 0)}")
                        else:
                            print(f"❌ 识别失败: {result.get('error')}")
                else:
                    print("❌ 在 itr 目录中没有找到图片文件")
            else:
                print("❌ itr 目录不存在")
        else:
            # 单张图片处理
            result = ocr.recognize_text(image_path)
            
            print("\n" + "="*50)
            print("📝 识别结果:")
            print("="*50)
            
            if result.get("success"):
                print("✅ 识别成功!")
                print(f"🤖 使用模型: {result.get('model', 'unknown')}")
                print("\n📄 识别内容:")
                print("-" * 40)
                print(result["text"])
                print("-" * 40)
                
                usage = result.get("usage", {})
                if usage:
                    print(f"\n💰 Token 使用:")
                    print(f"   输入: {usage.get('prompt_tokens', 0)}")
                    print(f"   输出: {usage.get('completion_tokens', 0)}")
                    print(f"   总计: {usage.get('total_tokens', 0)}")
            else:
                print(f"❌ 识别失败: {result.get('error')}")
    else:
        # 默认测试
        print("🔍 OpenRouter GPT-4O 图片识别测试")
        print("-" * 40)
        print("使用方法:")
        print("  python openrouter_ocr.py <图片路径>     # 识别单张图片")
        print("  python openrouter_ocr.py batch        # 批量识别 itr 目录下所有图片")
        print()
        
        # 尝试识别默认图片
        default_image = "itr/01.png"
        if os.path.exists(default_image):
            print(f"📷 尝试识别默认图片: {default_image}")
            result = ocr.recognize_text(default_image)
            
            if result.get("success"):
                print("✅ 识别成功!")
                print("📝 识别内容:")
                print("-" * 30)
                print(result["text"])
                print("-" * 30)
            else:
                print(f"❌ 识别失败: {result.get('error')}")
        else:
            print(f"⚠️  默认图片 {default_image} 不存在")
            print("请提供图片路径作为命令行参数")


if __name__ == "__main__":
    main()
