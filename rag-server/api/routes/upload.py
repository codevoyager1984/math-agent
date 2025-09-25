"""
文件上传API路由
"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger

from services.upload_service import UploadService


# 创建路由器
router = APIRouter()


class UploadResponse(BaseModel):
    """上传响应模型"""
    success: bool
    message: str
    url: str = None
    filename: str = None


class UploadConfigResponse(BaseModel):
    """上传配置响应模型"""
    max_file_size: int
    allowed_extensions: list
    max_file_size_mb: float


@router.post(
    "/image",
    response_model=UploadResponse,
    summary="上传图片文件",
    description="上传图片文件到阿里云OSS，支持常见图片格式"
)
async def upload_image(file: UploadFile = File(...)):
    """
    上传图片文件
    
    - **file**: 要上传的图片文件
    """
    try:
        upload_service = UploadService()
        result = await upload_service.upload_image(file)
        
        if result["success"]:
            return UploadResponse(
                success=True,
                message=result["message"],
                url=result["url"],
                filename=result["filename"]
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传图片失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传失败: {str(e)}"
        )


@router.get(
    "/config",
    response_model=UploadConfigResponse,
    summary="获取上传配置",
    description="获取上传文件的配置信息"
)
async def get_upload_config():
    """
    获取上传配置信息
    """
    try:
        upload_service = UploadService()
        # 创建一个虚拟的admin_user，因为这个接口不需要鉴权
        config = upload_service.get_upload_config(admin_user=None)
        
        return UploadConfigResponse(
            max_file_size=config["max_file_size"],
            allowed_extensions=config["allowed_extensions"],
            max_file_size_mb=config["max_file_size_mb"]
        )
        
    except Exception as e:
        logger.error(f"获取上传配置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取配置失败: {str(e)}"
        )


@router.delete(
    "/file/{filename}",
    response_model=dict,
    summary="删除文件",
    description="删除OSS上的文件"
)
async def delete_file(filename: str):
    """
    删除文件
    
    - **filename**: 要删除的文件名
    """
    try:
        upload_service = UploadService()
        # 创建一个虚拟的admin_user，因为这个接口不需要鉴权
        result = upload_service.delete_file(filename, admin_user=None)
        
        if result["success"]:
            return {
                "success": True,
                "message": result["message"]
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除文件失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除失败: {str(e)}"
        )
