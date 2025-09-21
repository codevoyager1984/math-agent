# 知识库数据迁移工具

## 功能说明

`migrate_knowledge_base.py` 是一个用于将知识库数据从一个服务迁移到另一个服务的工具脚本。

### 主要功能

1. **数据获取**: 通过 `get_knowledge_points` 接口从源服务拉取所有知识库数据
2. **数据转换**: 自动将源数据格式转换为目标服务兼容的格式
3. **批量写入**: 通过 `batch_add_documents` 接口将数据批量写入目标服务
4. **进度显示**: 实时显示迁移进度和统计信息
5. **错误处理**: 详细的错误记录和失败重试机制

## 使用方法

### 基本用法

```bash
# 进入脚本目录
cd /path/to/rag-server

# 执行迁移
python scripts/migrate_knowledge_base.py \
  --source http://source-server:8000 \
  --target http://target-server:8000
```

### 高级选项

```bash
# 指定批量处理大小
python scripts/migrate_knowledge_base.py \
  --source http://localhost:8001 \
  --target http://localhost:8002 \
  --batch-size 100

# 预览模式（只获取数据，不执行迁移）
python scripts/migrate_knowledge_base.py \
  --source http://localhost:8001 \
  --target http://localhost:8002 \
  --dry-run
```

### 参数说明

- `--source`: **必需**，源服务的基础URL
- `--target`: **必需**，目标服务的基础URL  
- `--batch-size`: 可选，批量处理的大小，默认50
- `--dry-run`: 可选，预览模式，只获取数据不执行迁移

## 接口要求

### 源服务接口

- **GET** `/api/knowledge-base/documents`
  - 支持分页参数：`page`, `limit`
  - 返回格式：
    ```json
    {
      "knowledge_points": [...],
      "total": 100,
      "page": 1,
      "limit": 20
    }
    ```

### 目标服务接口

- **POST** `/api/knowledge-base/batch-add`
  - 请求格式：
    ```json
    {
      "knowledge_points": [
        {
          "title": "知识点标题",
          "description": "知识点描述", 
          "category": "分类",
          "examples": [
            {
              "question": "例题",
              "solution": "解答",
              "difficulty": "medium"
            }
          ],
          "tags": ["标签1", "标签2"]
        }
      ]
    }
    ```
  - 返回格式：
    ```json
    {
      "success_count": 45,
      "failed_count": 5,
      "total_count": 50,
      "success_ids": ["id1", "id2", ...],
      "errors": ["错误信息1", "错误信息2", ...]
    }
    ```

## 输出示例

```
🚀 Math Agent 知识库迁移工具
==================================================
源服务: http://localhost:8001
目标服务: http://localhost:8002
批量大小: 50
运行模式: 迁移模式

📡 开始从源服务获取知识点数据: http://localhost:8001
   正在获取第 1 页数据...
   ✅ 获取到 50 个知识点 (总计: 50/127)
   正在获取第 2 页数据...
   ✅ 获取到 50 个知识点 (总计: 100/127)
   正在获取第 3 页数据...
   ✅ 获取到 27 个知识点 (总计: 127/127)
   已获取完所有数据
🎉 成功获取 127 个知识点

📤 开始向目标服务迁移数据: http://localhost:8002
   总共 127 个知识点，每批次 50 个
   正在处理第 1/3 批...
   ✅ 第 1 批完成: 成功 50, 失败 0
   正在处理第 2/3 批...
   ✅ 第 2 批完成: 成功 50, 失败 0
   正在处理第 3/3 批...
   ✅ 第 3 批完成: 成功 27, 失败 0

📊 迁移完成统计:
   总处理数量: 127
   成功数量: 127
   失败数量: 0
   成功率: 100.0%

🎉 迁移任务执行成功!

💡 建议:
   - 验证目标服务中的数据完整性
   - 检查是否有数据丢失或错误
```

## 注意事项

1. **网络连接**: 确保脚本运行环境能够访问源服务和目标服务
2. **接口兼容性**: 确保源服务和目标服务的接口格式符合预期
3. **数据量**: 对于大量数据，建议使用较小的批量大小以避免超时
4. **错误处理**: 如果迁移失败，检查错误日志并重新运行
5. **无需认证**: 当前版本不支持需要认证的接口

## 依赖项

脚本依赖以下Python包：
- `aiohttp`: 用于异步HTTP请求
- `asyncio`: 用于异步编程
- `argparse`: 用于命令行参数解析

这些依赖项应该已经包含在项目的 `requirements.txt` 中。

## 故障排除

### 常见错误

1. **连接错误**: 检查服务URL是否正确，服务是否正在运行
2. **格式错误**: 检查接口返回的数据格式是否符合预期
3. **权限错误**: 确保接口不需要认证或有正确的访问权限
4. **超时错误**: 尝试减小批量大小或检查网络连接

### 调试技巧

1. 使用 `--dry-run` 模式先测试连接和数据格式
2. 减小 `--batch-size` 以定位具体问题
3. 检查脚本输出的详细错误信息
4. 确认源服务和目标服务的API接口正常工作

## 扩展功能

如需添加新功能，可以考虑：
- 支持认证机制
- 增量迁移支持
- 数据验证和对比
- 更详细的日志记录
- 配置文件支持
