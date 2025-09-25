"""
Upload service for handling file upload operations
"""
import os
import uuid
from datetime import datetime
from typing import Optional, Dict, Any
import oss2
from fastapi import HTTPException, UploadFile

from models.admin_user import AdminUser


class UploadService():
    """Upload service handling file upload operations"""
    
    def __init__(self):
        super().__init__()
        
        # 阿里云OSS配置
        self.oss_config = {
            "access_key_id": os.getenv("OSS_ACCESS_KEY_ID", ""),
            "access_key_secret": os.getenv("OSS_ACCESS_KEY_SECRET", ""),
            "bucket_name": os.getenv("OSS_BUCKET_NAME", ""),
            "endpoint": os.getenv("OSS_ENDPOINT", ""),
            "domain": os.getenv("OSS_DOMAIN", ""),  # 自定义域名，如果有的话
        }
        
        # 支持的文件类型
        self.allowed_extensions = {
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
        }
        
        # 文件大小限制 (5MB)
        self.max_file_size = 5 * 1024 * 1024
    
    def get_oss_bucket(self):
        """获取OSS bucket实例"""
        if not all([
            self.oss_config["access_key_id"], 
            self.oss_config["access_key_secret"], 
            self.oss_config["bucket_name"], 
            self.oss_config["endpoint"]
        ]):
            raise HTTPException(
                status_code=500,
                detail="OSS配置不完整，请检查环境变量"
            )
        
        auth = oss2.Auth(self.oss_config["access_key_id"], self.oss_config["access_key_secret"])
        bucket = oss2.Bucket(auth, self.oss_config["endpoint"], self.oss_config["bucket_name"])
        return bucket
    
    def generate_filename(self, original_filename: str, folder: str = "uploads") -> str:
        """生成唯一的文件名"""
        # 获取文件扩展名
        file_ext = original_filename.split('.')[-1].lower() if '.' in original_filename else ''
        
        # 生成唯一文件名：文件夹/年月日/UUID.扩展名
        date_str = datetime.now().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4())
        
        if file_ext:
            filename = f"{folder}/{date_str}/{unique_id}.{file_ext}"
        else:
            filename = f"{folder}/{date_str}/{unique_id}"
        
        return filename
    
    def validate_file(self, file: UploadFile) -> bool:
        """验证文件类型和大小"""
        # 检查文件类型
        if file.content_type not in self.allowed_extensions:
            return False
        
        # 检查文件大小 (需要读取文件内容来获取大小)
        file.file.seek(0, 2)  # 移动到文件末尾
        file_size = file.file.tell()
        file.file.seek(0)  # 重置到文件开头
        
        if file_size > self.max_file_size:
            return False
        
        return True
    
    async def upload_image(self, file: UploadFile, folder: Optional[str] = "product-images") -> Dict[str, Any]:
        """上传图片到阿里云OSS"""
        try:
            # 验证文件
            if not self.validate_file(file):
                return {
                    "success": False,
                    "message": "文件格式不支持或文件过大（最大5MB）"
                }
            
            # 获取OSS bucket
            bucket = self.get_oss_bucket()
            
            # 生成文件名
            filename = self.generate_filename(file.filename, folder)
            
            # 读取文件内容
            file_content = await file.read()
            
            # 上传到OSS
            result = bucket.put_object(filename, file_content)
            
            if result.status == 200:
                # 构建文件URL
                if self.oss_config["domain"]:
                    file_url = f"https://{self.oss_config['domain']}/{filename}"
                else:
                    endpoint_clean = self.oss_config["endpoint"].replace('https://', '').replace('http://', '')
                    file_url = f"https://{self.oss_config['bucket_name']}.{endpoint_clean}/{filename}"
                
                return {
                    "success": True,
                    "message": "文件上传成功",
                    "url": file_url,
                    "filename": filename
                }
            else:
                return {
                    "success": False,
                    "message": f"上传失败，状态码: {result.status}"
                }
        
        except Exception as e:
            return {
                "success": False,
                "message": f"上传失败: {str(e)}"
            }
    
    def delete_file(self, filename: str, admin_user: AdminUser) -> Dict[str, Any]:
        """删除OSS上的文件"""
        try:
            # 获取OSS bucket
            bucket = self.get_oss_bucket()
            
            # 删除文件
            bucket.delete_object(filename)
            
            return {
                "success": True,
                "message": "文件删除成功"
            }
        
        except Exception as e:
            return {
                "success": False,
                "message": f"删除失败: {str(e)}"
            }
    
    def get_upload_config(self, admin_user: AdminUser) -> Dict[str, Any]:
        """获取上传配置信息"""
        return {
            "max_file_size": self.max_file_size,
            "allowed_extensions": list(self.allowed_extensions),
            "max_file_size_mb": self.max_file_size / (1024 * 1024)
        }
