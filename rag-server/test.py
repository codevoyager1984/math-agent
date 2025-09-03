import asyncio
import chromadb
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

# 3. 准备数据
documents = [
    {
        "id": "1",
        "content": "知识点: 一元二次方程解法\n公式: x = [-b ± sqrt(b^2 - 4ac)] / 2a\n例题: 解方程 x^2 - 5x + 6 = 0\n解答过程: 因式分解得到 (x-2)(x-3)=0, 解得 x=2 或 x=3",
    },
    {
        "id": "2",
        "content": "知识点: 勾股定理\n公式: a^2 + b^2 = c^2\n例题: 直角三角形两直角边长为3,4, 求斜边\n解答过程: c = sqrt(3^2+4^2)=5",
    },
]


async def main():
    client = await chromadb.AsyncHttpClient(host="localhost", port=18000)
    collection = await client.get_or_create_collection(name="math_knowledge")
    for doc in documents:
        embedding = model.encode(doc["content"]).tolist()
        await collection.add(
            documents=[doc["content"]],
            ids=[doc["id"]],
            embeddings=[embedding],
        )
    results = await collection.query(query_texts=["一元二次方程解法"], n_results=1)
    print(results)


asyncio.run(main())
