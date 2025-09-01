# OpenRouter GPT-4O 图片文字识别工具

这个项目包含了使用 OpenRouter GPT-4O 进行图片文字识别的示例代码，特别针对数学公式识别进行了优化。

## 📁 文件结构

```
├── openrouter_ocr.py          # 通用图片文字识别
├── math_formula_ocr.py        # 专用数学公式识别
├── WebITRTeach.py            # 科大讯飞公式识别（对比参考）
└── itr/                      # 测试图片目录
    ├── 01.png
    ├── 02.jpg
    ├── 03.jpg
    └── 04.jpg
```

## 🔧 配置

### API Key 设置

你可以通过以下两种方式设置 API Key：

#### 方法 1：环境变量（推荐）
```bash
export OPENAI_API_KEY=sk-or-v1-your-api-key-here
```

#### 方法 2：直接修改代码
在代码中找到 `API_KEY` 变量并修改：
```python
API_KEY = "sk-or-v1-your-actual-api-key"
```

### OpenRouter 配置信息
```
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL_NAME=openai/gpt-4o
OPENAI_API_KEY=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
```

## 🚀 使用方法

### 1. 通用图片文字识别 (`openrouter_ocr.py`)

```bash
# 识别单张图片
python openrouter_ocr.py itr/01.png

# 批量识别所有图片
python openrouter_ocr.py batch

# 显示帮助
python openrouter_ocr.py
```

**功能特点：**
- 支持识别普通文字、数学公式、数字和特殊字符
- 自动输出 LaTeX 格式的数学公式
- 支持批量处理
- 详细的使用统计信息

### 2. 专用数学公式识别 (`math_formula_ocr.py`)

```bash
# 完整识别（默认模式）
python math_formula_ocr.py itr/01.png

# 只识别公式
python math_formula_ocr.py itr/01.png formula

# 只输出 LaTeX
python math_formula_ocr.py itr/01.png latex

# 结构化 JSON 输出
python math_formula_ocr.py itr/02.jpg structured
```

**识别模式说明：**

| 模式 | 参数 | 说明 |
|------|------|------|
| 完整识别 | `complete` | 识别所有内容并分类输出 |
| 公式模式 | `formula` | 只识别数学公式 |
| LaTeX模式 | `latex` | 直接输出LaTeX代码 |
| 结构化模式 | `structured` | JSON格式的结构化输出 |

## 📊 输出示例

### 完整识别模式
```
## 识别结果
### 文字内容
- 已知 y = f(x) 是偶函数

### 数学公式
- $P(m-4, m+1)$
- $\frac{f(x)}{g(x)} \leq 0$

### 数学符号和表达式
- 变量: x, y, m
- 函数: f(x), g(x)
```

### LaTeX 模式
```latex
P(m-4, m+1)
```

### 结构化模式
```json
{
  "text_content": ["已知 y = f(x) 是偶函数"],
  "formulas": [
    {
      "type": "inline",
      "latex": "y = f(x)",
      "description": "偶函数"
    }
  ],
  "variables": ["x", "y"],
  "functions": ["f(x)", "g(x)"]
}
```

## 🆚 与科大讯飞对比

项目中还包含了科大讯飞的公式识别工具作为对比：

```bash
# 科大讯飞识别
python WebITRTeach.py itr/01.png

# OpenRouter GPT-4O识别
python openrouter_ocr.py itr/01.png
```

**对比优势：**

| 特性 | OpenRouter GPT-4O | 科大讯飞 |
|------|-------------------|----------|
| 识别准确度 | 极高 | 高 |
| 数学公式支持 | 完美LaTeX格式 | 基础支持 |
| 复杂图像处理 | 优秀 | 良好 |
| 自然语言理解 | 强大 | 一般 |
| 输出格式 | 灵活多样 | 固定格式 |
| 成本 | 按Token计费 | 按次计费 |

## 💰 成本参考

GPT-4O 通过 OpenRouter 的大概成本：
- 输入：$15/1M tokens
- 输出：$60/1M tokens

典型使用场景：
- 简单公式（如例子中的 `P(m-4,m+1)`）：约 $0.01
- 复杂数学题目：约 $0.05-0.15
- 批量处理：建议监控Token使用量

## 🛠️ 依赖安装

```bash
pip install requests
```

## 📝 注意事项

1. **API Key 安全**：请不要将 API Key 提交到代码仓库
2. **图片格式**：支持 PNG, JPG, JPEG, GIF, WebP
3. **图片大小**：建议不超过 20MB
4. **网络连接**：需要稳定的网络连接访问 OpenRouter API
5. **Token 限制**：注意监控 Token 使用量，避免超出预算

## 🔧 高级用法

### 自定义提示词
```python
# 在 math_formula_ocr.py 中可以自定义识别提示词
custom_prompt = "请识别这个积分公式并转换为LaTeX格式"
result = ocr._recognize_with_custom_prompt(image_path, custom_prompt)
```

### 与参考公式比较
```python
reference_formulas = ["P(m-4,m+1)", "f(x) = ax^2 + bx + c"]
result = ocr.compare_with_reference(image_path, reference_formulas)
```

## 🐛 问题排查

1. **API Key 错误**：检查环境变量或代码中的 API Key
2. **网络超时**：检查网络连接，可以增加 timeout 参数
3. **识别失败**：确保图片清晰，文字/公式可读
4. **Token 超限**：检查账户余额和使用量

## 📞 支持

如果遇到问题，可以：
1. 检查 OpenRouter 官方文档
2. 验证 API Key 是否有效
3. 确认账户是否有足够余额
4. 检查图片质量和格式
