/**
 * RAG 服务器配置
 */

/**
 * 获取RAG服务器基础URL
 * @returns RAG服务器的基础URL
 */
export function getRagServerUrl(): string {
  console.log("getRagServerUrl", process.env.NEXT_PUBLIC_RAG_SERVER_URL);
  return process.env.NEXT_PUBLIC_RAG_SERVER_URL || "http://localhost:8000";
}

/**
 * 获取RAG服务器API基础URL
 * @returns RAG服务器API的基础URL
 */
export function getRagApiUrl(): string {
  return `${getRagServerUrl()}/api`;
}

/**
 * 获取文件上传API URL
 * @returns 文件上传API的完整URL
 */
export function getUploadApiUrl(): string {
  return `${getRagApiUrl()}/upload/image`;
}

/**
 * 获取上传配置API URL
 * @returns 上传配置API的完整URL
 */
export function getUploadConfigApiUrl(): string {
  return `${getRagApiUrl()}/upload/config`;
}

/**
 * 获取文件删除API URL
 * @param filename 要删除的文件名
 * @returns 文件删除API的完整URL
 */
export function getDeleteFileApiUrl(filename: string): string {
  return `${getRagApiUrl()}/upload/file/${encodeURIComponent(filename)}`;
}

/**
 * RAG服务器配置对象
 */
export const ragConfig = {
  getBaseUrl: getRagServerUrl,
  getApiUrl: getRagApiUrl,
  getUploadUrl: getUploadApiUrl,
  getUploadConfigUrl: getUploadConfigApiUrl,
  getDeleteFileUrl: getDeleteFileApiUrl,
} as const;
