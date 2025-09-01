#!/usr/bin/env python 
# -*- coding:utf-8 -*-

#
# 公式识别 WebAPI 接口调用示例
# 运行前：请先填写Appid、APIKey、APISecret
# 运行方法：直接运行 main 即可 
# 结果： 控制台输出结果信息
# 
# 1.接口文档（必看）：https://www.xfyun.cn/doc/words/formula-discern/API.html
# 2.错误码链接：https://www.xfyun.cn/document/error-code （错误码code为5位数字）
#

import requests
import datetime
import hashlib
import base64
import hmac
import json

class get_result(object):
    def __init__(self,host):
        # 应用ID（到控制台获取）
        self.APPID = "2eaa7fb4"
        # 接口APISercet（到控制台公式识别服务页面获取）
        self.Secret = "YTcxN2EwMmJmZTc1NTQ3NTQ2MDcwMzk5"
        # 接口APIKey（到控制台公式识别服务页面获取）
        self.APIKey= "caa0297c62e65fa79dbe938a2db5197e"
        
        # 以下为POST请求
        self.Host = host
        self.RequestUri = "/v2/itr"
        # 设置url
        # print(host)
        self.url="https://"+host+self.RequestUri
        self.HttpMethod = "POST"
        self.Algorithm = "hmac-sha256"
        self.HttpProto = "HTTP/1.1"

        # 设置当前时间
        curTime_utc = datetime.datetime.utcnow()
        self.Date = self.httpdate(curTime_utc)
        #设置测试图片文件
        self.AudioPath="itr/01.png"
        self.BusinessArgs={
                "ent": "teach-photo-print",
                "aue": "raw",
            }

    def imgRead(self, path):
        with open(path, 'rb') as fo:
            return fo.read()

    def hashlib_256(self, res):
        m = hashlib.sha256(bytes(res.encode(encoding='utf-8'))).digest()
        result = "SHA-256=" + base64.b64encode(m).decode(encoding='utf-8')
        return result

    def httpdate(self, dt):
        """
        Return a string representation of a date according to RFC 1123
        (HTTP/1.1).

        The supplied date must be in UTC.

        """
        weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][dt.weekday()]
        month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
                 "Oct", "Nov", "Dec"][dt.month - 1]
        return "%s, %02d %s %04d %02d:%02d:%02d GMT" % (weekday, dt.day, month,
                                                        dt.year, dt.hour, dt.minute, dt.second)

    def generateSignature(self, digest):
        signatureStr = "host: " + self.Host + "\n"
        signatureStr += "date: " + self.Date + "\n"
        signatureStr += self.HttpMethod + " " + self.RequestUri \
                        + " " + self.HttpProto + "\n"
        signatureStr += "digest: " + digest
        signature = hmac.new(bytes(self.Secret.encode(encoding='utf-8')),
                             bytes(signatureStr.encode(encoding='utf-8')),
                             digestmod=hashlib.sha256).digest()
        result = base64.b64encode(signature)
        return result.decode(encoding='utf-8')

    def init_header(self, data):
        digest = self.hashlib_256(data)
        #print(digest)
        sign = self.generateSignature(digest)
        authHeader = 'api_key="%s", algorithm="%s", ' \
                     'headers="host date request-line digest", ' \
                     'signature="%s"' \
                     % (self.APIKey, self.Algorithm, sign)
        #print(authHeader)
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Method": "POST",
            "Host": self.Host,
            "Date": self.Date,
            "Digest": digest,
            "Authorization": authHeader
        }
        return headers

    def parse_results(self, resp_data):
        """解析识别结果并格式化输出"""
        print("📝 解析识别结果:")
        print("-" * 30)
        
        try:
            if resp_data.get('code') == 0:
                data = resp_data.get('data', {})
                regions = data.get('region', [])
                
                if not regions:
                    print("❌ 未识别到任何内容")
                    return
                
                print(f"✅ 识别到 {len(regions)} 个区域:")
                print()
                
                for i, region in enumerate(regions, 1):
                    recog = region.get('recog', {})
                    content = recog.get('content', '')
                    region_type = region.get('type', 'unknown')
                    
                    print(f"区域 {i}:")
                    print(f"  类型: {region_type}")
                    print(f"  内容: {content}")
                    
                    # 显示详细的元素信息
                    elements = recog.get('element', [])
                    if elements:
                        element_contents = [elem.get('content', '') for elem in elements]
                        print(f"  详细: {''.join(element_contents)}")
                        print(f"  置信度: {[elem.get('conf', 0) for elem in elements]}")
                    
                    # 显示坐标信息
                    coord = region.get('coord', {})
                    if coord:
                        # 处理不同格式的坐标数据
                        if region_type == 'graph':
                            # 图形类型：使用 x, y, width, height
                            x = coord.get('x', 0)
                            y = coord.get('y', 0)
                            width = coord.get('width', 0)
                            height = coord.get('height', 0)
                            if width > 0 and height > 0:
                                print(f"  位置: 图形区域 x={x}, y={y}, 宽度={width}, 高度={height}")
                            else:
                                print(f"  位置: 图形区域 x={x}, y={y}")
                        else:
                            # 文本类型：使用坐标点列表
                            x_coords = coord.get('x', [])
                            y_coords = coord.get('y', [])
                            if x_coords and y_coords and isinstance(x_coords, list) and isinstance(y_coords, list):
                                # 转换字符串坐标为数字
                                try:
                                    x_nums = [int(x) for x in x_coords if str(x).isdigit()]
                                    y_nums = [int(y) for y in y_coords if str(y).isdigit()]
                                    if x_nums and y_nums:
                                        print(f"  位置: x=({min(x_nums)},{max(x_nums)}), y=({min(y_nums)},{max(y_nums)})")
                                except (ValueError, TypeError):
                                    print(f"  位置: 坐标解析错误")
                    
                    print()
                
                # 汇总所有文本识别内容（排除图形区域）
                text_content = []
                graph_count = 0
                for region in regions:
                    if region.get('type') == 'text':
                        content = region.get('recog', {}).get('content', '')
                        if content.strip():
                            text_content.append(content)
                    elif region.get('type') == 'graph':
                        graph_count += 1
                
                if text_content:
                    print("🔍 文本识别结果:")
                    print(' '.join(text_content))
                    print()
                
                if graph_count > 0:
                    print(f"📊 图形区域数量: {graph_count}")
                    print()
                
                # 引擎信息
                engine_info = data.get('_engine_info', {})
                if engine_info:
                    print("🔧 引擎信息:")
                    print(f"  名称: {engine_info.get('name', 'Unknown')}")
                    print(f"  版本: {engine_info.get('version', 'Unknown')}")
                    print(f"  类别: {engine_info.get('category', 'Unknown')}")
                
            else:
                print(f"❌ 识别失败，错误代码: {resp_data.get('code')}")
                print(f"错误信息: {resp_data.get('message', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ 解析结果时出错: {str(e)}")

    def set_image_path(self, image_path):
        """设置要识别的图片路径"""
        self.AudioPath = image_path
        print(f"🖼️  设置图片路径: {image_path}")

    def get_body(self):
        audioData = self.imgRead((self.AudioPath))
        content = base64.b64encode(audioData).decode(encoding='utf-8')
        postdata = {
            "common": {"app_id": self.APPID},
            "business": self.BusinessArgs,
            "data": {
                "image": content,
            }
        }
        body = json.dumps(postdata)
        #print(body)
        return body

    def call_url(self):
        if self.APPID == '' or self.APIKey == '' or self.Secret == '':
            print('Appid 或APIKey 或APISecret 为空！请打开demo代码，填写相关信息。')
        else:
            code = 0
            body=self.get_body()
            headers=self.init_header(body)
            #print(self.url)
            response = requests.post(self.url, data=body, headers=headers,timeout=60)
            status_code = response.status_code
            #print(response.content)
            if status_code!=200:
                # 鉴权失败
                print("Http请求失败，状态码：" + str(status_code) + "，错误信息：" + response.text)
                print("请根据错误信息检查代码，接口文档：https://www.xfyun.cn/doc/words/formula-discern/API.html")
            else:
                # 鉴权成功
                respData = json.loads(response.text)
                print("原始响应数据:")
                print(respData)
                print("\n" + "="*50)
                
                # 解析结果
                self.parse_results(respData)
                
                # 以下仅用于调试
                code = str(respData["code"])
                if code!='0':
                    print("请前往https://www.xfyun.cn/document/error-code?code=" + code + "查询解决办法")

if __name__ == '__main__':
    import sys
    import os
    
    ##示例:  host="rest-api.xfyun.cn"域名形式
    host = "rest-api.xfyun.cn"
    #初始化类
    gClass = get_result(host)
    
    # 支持命令行参数指定图片
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if os.path.exists(image_path):
            gClass.set_image_path(image_path)
        else:
            print(f"❌ 图片文件不存在: {image_path}")
            sys.exit(1)
    
    print("🚀 开始进行公式识别...")
    print(f"📷 当前图片: {gClass.AudioPath}")
    print("="*50)
    
    gClass.call_url()
    
    print("\n" + "="*50)
    print("✨ 识别完成!")
    
    # 如果没有指定图片，提示可以测试其他图片
    if len(sys.argv) <= 1:
        print("\n💡 提示: 可以通过命令行参数指定其他图片进行测试")
        print("   例如: python WebITRTeach.py itr/02.jpg")
        
        # 列出可用的测试图片
        itr_dir = "itr"
        if os.path.exists(itr_dir):
            image_files = [f for f in os.listdir(itr_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
            if image_files:
                print(f"\n📁 可用的测试图片:")
                for img in sorted(image_files):
                    print(f"   - {os.path.join(itr_dir, img)}")
