#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
专门用于数学公式识别的 OpenRouter GPT-4O 示例代码
针对数学公式和教学图片进行优化
"""

import os
import sys
import base64
import requests
import json
from typing import Optional, Dict, Any, List


class MathFormulaOCR:
    def __init__(self, api_key: str):
        """初始化数学公式识别客户端"""
        self.api_key = api_key
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "openai/gpt-4o"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/math-ocr-project",
            "X-Title": "Math Formula OCR"
        }
    
    def encode_image(self, image_path: str) -> Optional[str]:
        """编码图片为 base64"""
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')
        except Exception as e:
            print(f"❌ 图片编码失败: {e}")
            return None
    
    def get_image_mime_type(self, image_path: str) -> str:
        """获取图片 MIME 类型"""
        extension = os.path.splitext(image_path)[1].lower()
        mime_types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        return mime_types.get(extension, 'image/jpeg')
    
    def recognize_math_formula(self, image_path: str, mode: str = "complete") -> Dict[str, Any]:
        """
        识别数学公式
        
        Args:
            image_path: 图片路径
            mode: 识别模式
                - "complete": 完整识别（默认）
                - "formula_only": 只识别公式
                - "latex_only": 只输出 LaTeX
                - "structured": 结构化输出
        """
        if not os.path.exists(image_path):
            return {"error": f"图片文件不存在: {image_path}"}
        
        base64_image = self.encode_image(image_path)
        if not base64_image:
            return {"error": "图片编码失败"}
        
        mime_type = self.get_image_mime_type(image_path)
        
        # 根据模式选择不同的提示词
        prompts = {
            "complete": """
请仔细分析这张图片中的数学内容，并按以下格式输出：

## 识别结果
### 文字内容
- [列出所有普通文字内容]

### 数学公式
- [用 LaTeX 格式列出所有数学公式]

### 数学符号和表达式
- [列出所有数学符号、变量、函数等]

### 图表和图形
- [如果有图表、函数图像等，请描述]

请确保：
1. LaTeX 公式格式正确
2. 不遗漏任何数学内容
3. 按从上到下、从左到右的顺序
4. 区分行内公式 $...$ 和独立公式 $$...$$
            """,
            
            "formula_only": """
请识别图片中的所有数学公式，并用标准的 LaTeX 格式输出。

要求：
- 只输出数学公式，忽略其他文字
- 使用正确的 LaTeX 语法
- 行内公式用 $...$，独立公式用 $$...$$
- 按顺序列出所有公式
            """,
            
            "latex_only": """
请将图片中的所有数学内容转换为 LaTeX 代码。

输出格式：直接输出 LaTeX 代码，不需要其他说明。
要求：使用标准 LaTeX 数学语法。
            """,
            
            "structured": """
请分析图片中的数学内容，并以 JSON 格式输出：

{
  "text_content": ["普通文字内容"],
  "formulas": [
    {
      "type": "inline/display",
      "latex": "LaTeX代码",
      "description": "公式描述"
    }
  ],
  "variables": ["变量列表"],
  "functions": ["函数列表"],
  "symbols": ["特殊符号列表"],
  "graphs": ["图表描述"],
  "equations": ["方程式"],
  "page_structure": "页面结构描述"
}
            """
        }
        
        prompt = prompts.get(mode, prompts["complete"])
        
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
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 3000,
            "temperature": 0.0  # 最低温度确保一致性
        }
        
        try:
            print(f"🔍 使用 GPT-4O 识别数学内容: {image_path}")
            print(f"📋 识别模式: {mode}")
            print("⏳ 正在处理...")
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=90
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if 'choices' in result and len(result['choices']) > 0:
                    content = result['choices'][0]['message']['content']
                    
                    # 如果是结构化模式，尝试解析 JSON
                    parsed_content = content
                    if mode == "structured":
                        try:
                            # 提取 JSON 部分
                            json_start = content.find('{')
                            json_end = content.rfind('}') + 1
                            if json_start != -1 and json_end > json_start:
                                json_str = content[json_start:json_end]
                                parsed_content = json.loads(json_str)
                        except:
                            pass  # 如果解析失败，保持原文本
                    
                    return {
                        "success": True,
                        "content": parsed_content,
                        "raw_text": content,
                        "mode": mode,
                        "model": result.get('model'),
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
                
        except Exception as e:
            return {"error": f"请求异常: {str(e)}"}
    
    def compare_with_reference(self, image_path: str, reference_formulas: List[str]) -> Dict[str, Any]:
        """
        识别公式并与参考公式比较
        
        Args:
            image_path: 图片路径
            reference_formulas: 参考公式列表
        """
        prompt = f"""
请识别图片中的数学公式，并与以下参考公式进行比较：

参考公式：
{chr(10).join(f"- {formula}" for formula in reference_formulas)}

请输出：
1. 识别到的公式（LaTeX格式）
2. 与参考公式的匹配情况
3. 识别准确度评估
4. 差异分析（如果有）
        """
        
        return self._recognize_with_custom_prompt(image_path, prompt)
    
    def _recognize_with_custom_prompt(self, image_path: str, prompt: str) -> Dict[str, Any]:
        """使用自定义提示词识别"""
        if not os.path.exists(image_path):
            return {"error": f"图片文件不存在: {image_path}"}
        
        base64_image = self.encode_image(image_path)
        if not base64_image:
            return {"error": "图片编码失败"}
        
        mime_type = self.get_image_mime_type(image_path)
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 2000,
            "temperature": 0.0
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'choices' in result and len(result['choices']) > 0:
                    return {
                        "success": True,
                        "content": result['choices'][0]['message']['content'],
                        "usage": result.get('usage', {})
                    }
            
            return {"error": f"API 请求失败: {response.status_code}"}
            
        except Exception as e:
            return {"error": f"请求异常: {str(e)}"}


def print_result(result: Dict[str, Any], show_usage: bool = True):
    """格式化打印识别结果"""
    if result.get("success"):
        print("✅ 识别成功!")
        print(f"🤖 模式: {result.get('mode', 'custom')}")
        
        if result.get('model'):
            print(f"🔧 模型: {result['model']}")
        
        print("\n" + "="*60)
        print("📝 识别结果:")
        print("="*60)
        
        # 根据内容类型显示
        content = result.get("content")
        if isinstance(content, dict):
            # 结构化结果
            print(json.dumps(content, ensure_ascii=False, indent=2))
        else:
            # 文本结果
            print(content)
        
        print("="*60)
        
        if show_usage and result.get("usage"):
            usage = result["usage"]
            print(f"\n💰 Token 使用:")
            print(f"   输入: {usage.get('prompt_tokens', 0)}")
            print(f"   输出: {usage.get('completion_tokens', 0)}")
            print(f"   总计: {usage.get('total_tokens', 0)}")
    else:
        print(f"❌ 识别失败: {result.get('error')}")


def main():
    """主函数"""
    # API Key 配置
    API_KEY = os.getenv("OPENAI_API_KEY", "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")
    
    if not API_KEY:
        print("❌ 请设置 OPENAI_API_KEY 环境变量")
        return
    
    ocr = MathFormulaOCR(API_KEY)
    
    if len(sys.argv) < 2:
        print("🧮 数学公式识别工具")
        print("-" * 40)
        print("使用方法:")
        print("  python math_formula_ocr.py <图片路径> [模式]")
        print()
        print("模式选项:")
        print("  complete    - 完整识别（默认）")
        print("  formula     - 只识别公式")
        print("  latex       - 只输出LaTeX")
        print("  structured  - 结构化JSON输出")
        print()
        print("示例:")
        print("  python math_formula_ocr.py itr/01.png")
        print("  python math_formula_ocr.py itr/02.jpg formula")
        print("  python math_formula_ocr.py itr/03.jpg latex")
        
        # 默认测试
        default_image = "itr/01.png"
        if os.path.exists(default_image):
            print(f"\n📷 测试默认图片: {default_image}")
            result = ocr.recognize_math_formula(default_image, "complete")
            print_result(result)
        return
    
    image_path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else "complete"
    
    # 模式映射
    mode_map = {
        "complete": "complete",
        "formula": "formula_only", 
        "latex": "latex_only",
        "structured": "structured"
    }
    
    actual_mode = mode_map.get(mode, "complete")
    
    print(f"🔍 处理图片: {image_path}")
    print(f"📋 识别模式: {mode}")
    
    result = ocr.recognize_math_formula(image_path, actual_mode)
    print_result(result)


if __name__ == "__main__":
    main()
