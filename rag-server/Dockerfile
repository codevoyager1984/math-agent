FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

# 配置 pip 国内镜像源
RUN pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip config set global.trusted-host pypi.tuna.tsinghua.edu.cn

RUN pip install --no-cache-dir --timeout 1000 -r requirements.txt && \
    rm -rf /root/.cache/pip && \
    find /usr/local/lib/python3.12/site-packages -name "*.pyc" -delete

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# 复制应用代码
COPY . .

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
