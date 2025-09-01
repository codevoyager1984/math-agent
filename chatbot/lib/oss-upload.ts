import 'server-only';
import { createHmac } from 'crypto';
import { nanoid } from 'nanoid';

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  contentType: string;
}

function createOSSSignature(
  method: string,
  contentMD5: string,
  contentType: string,
  date: string,
  canonicalizedOSSHeaders: string,
  canonicalizedResource: string
): string {
  const stringToSign = `${method}\n${contentMD5}\n${contentType}\n${date}\n${canonicalizedOSSHeaders}${canonicalizedResource}`;
  console.log('String to sign:', stringToSign);
  const signature = createHmac('sha1', process.env.OSS_ACCESS_KEY_SECRET!)
    .update(stringToSign)
    .digest('base64');
  console.log('Generated signature:', signature);
  return signature;
}

export async function uploadFileToOSS(
  file: Buffer,
  originalFileName: string,
  contentType: string
): Promise<UploadResult> {
  try {
    // Generate unique filename to avoid conflicts
    const fileExtension = originalFileName.split('.').pop();
    const uniqueFileName = `uploads/${nanoid()}.${fileExtension}`;
    
    const bucket = process.env.OSS_BUCKET_NAME!;
    const endpoint = process.env.OSS_ENDPOINT!;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
    
    const date = new Date().toUTCString();
    
    // OSS 需要规范化的资源路径
    const canonicalizedResource = `/${bucket}/${uniqueFileName}`;
    
    // OSS 头部（按字母顺序排列）
    const ossHeaders = {
      'x-oss-meta-original-name': originalFileName,
      'x-oss-meta-upload-time': new Date().toISOString(),
    };
    
    // 构建规范化的 OSS 头部字符串
    const canonicalizedOSSHeaders = Object.keys(ossHeaders)
      .sort()
      .map(key => `${key}:${ossHeaders[key as keyof typeof ossHeaders]}\n`)
      .join('');
    
    const signature = createOSSSignature(
      'PUT', 
      '', // Content-MD5 
      contentType, 
      date, 
      canonicalizedOSSHeaders,
      canonicalizedResource
    );
    
    const authorization = `OSS ${accessKeyId}:${signature}`;
    
    const url = `https://${bucket}.${endpoint}/${uniqueFileName}`;
    
    console.log('Upload URL:', url);
    console.log('Authorization:', authorization);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Date': date,
        'Authorization': authorization,
        ...ossHeaders,
      },
      body: file,
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('OSS Response:', responseText);
      throw new Error(`OSS upload failed: ${response.status} ${response.statusText}`);
    }

    return {
      url,
      name: uniqueFileName,
      size: file.length,
      contentType,
    };
  } catch (error) {
    console.error('OSS upload error:', error);
    throw new Error(`Failed to upload file to OSS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteFileFromOSS(fileName: string): Promise<void> {
  try {
    const bucket = process.env.OSS_BUCKET_NAME!;
    const endpoint = process.env.OSS_ENDPOINT!;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID!;
    
    const date = new Date().toUTCString();
    const canonicalizedResource = `/${bucket}/${fileName}`;
    const signature = createOSSSignature('DELETE', '', '', date, '', canonicalizedResource);
    const authorization = `OSS ${accessKeyId}:${signature}`;
    
    const url = `https://${bucket}.${endpoint}/${fileName}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Date': date,
        'Authorization': authorization,
      },
    });

    if (!response.ok) {
      throw new Error(`OSS delete failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('OSS delete error:', error);
    throw new Error(`Failed to delete file from OSS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
