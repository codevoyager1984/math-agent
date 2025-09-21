FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

# 配置 pip 国内镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

RUN pip install --no-cache-dir --timeout 1000 -r requirements.txt && \
    rm -rf /root/.cache/pip && \
    find /usr/local/lib/python3.12/site-packages -name "*.pyc" -delete

# 配置 Hugging Face 镜像源和预下载模型
ENV HF_ENDPOINT=https://hf-mirror.com
ENV TRANSFORMERS_CACHE=/app/model_cache
ENV SENTENCE_TRANSFORMERS_HOME=/app/model_cache

# 创建模型缓存目录
RUN mkdir -p /app/model_cache

# 预下载嵌入模型
RUN python -c "\
import os; \
from sentence_transformers import SentenceTransformer; \
print('开始下载嵌入模型...'); \
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', cache_folder='/app/model_cache'); \
print('模型下载完成')"

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# 复制应用代码
COPY . .

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
