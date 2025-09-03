import axios, { AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

export const BASE_URL = '/api';

export const getAccessToken = () => {
  const key = 'auth';
  const auth = localStorage.getItem(key);
  try {
    if (auth) {
      const {
        state: { accessToken },
      } = JSON.parse(auth);
      return accessToken;
    }
  } catch (error) {}

  return null;
};

export interface RequestOptions {
  toastError?: boolean;
}

export const request = async <T>(
  requestConfig: AxiosRequestConfig,
  requestOptions?: RequestOptions
) => {
  const { url, ...options } = requestConfig;
  const accessToken = getAccessToken();
  const { toastError = true } = requestOptions || {};

  try {
    const response = await axios.request({
      url: `${BASE_URL}${url}`,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
        ...options.headers,
      },
      timeout: 0, // 0 表示无超时限制
    });

    return response.data as T;
  } catch (error: any) {
    if (toastError) {
      let errMsg = '请求失败';
      
      if (error.response?.data) {
        const data = error.response.data;
        
        // 处理字符串类型的错误消息
        if (typeof data.message === 'string') {
          errMsg = data.message;
        } else if (typeof data.error === 'string') {
          errMsg = data.error;
        } else if (data.detail) {
          // 处理FastAPI的验证错误格式
          if (typeof data.detail === 'string') {
            errMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            // 处理验证错误数组
            errMsg = data.detail.map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.msg) return err.msg;
              return '验证错误';
            }).join(', ');
          } else if (typeof data.detail === 'object' && data.detail.msg) {
            errMsg = data.detail.msg;
          }
        }
      } else if (error.message) {
        errMsg = error.message;
      }
      
      toast.error(errMsg);
    }
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('auth');
      window.location.href = '/login';
    }
    throw error;
  }
};

export const simpleFilePut = (
  url: string,
  file: File,
  process: (value: number, event: ProgressEvent<XMLHttpRequestEventTarget>) => void
): Promise<XMLHttpRequest> =>
  new Promise((resolve, reject) => {
    const accessToken = getAccessToken();
    const req = new XMLHttpRequest();
    req.open('PUT', url, true);
    req.setRequestHeader('Content-Type', file.type);
    req.setRequestHeader('Authorization', accessToken ? `Bearer ${accessToken}` : '');
    req.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        process(Math.round((e.loaded / e.total) * 100), e);
      }
    });

    req.onload = () => {
      if (req.status === 200 || req.status === 201) {
        resolve(req);
      } else {
        reject(new Error(`Request failed with status ${req.status}`));
      }
    };

    req.onerror = () => {
      reject(new Error('Request error'));
    };

    req.send(file);
  });

export const downloadFile = async <T>(requestConfig: AxiosRequestConfig) => {
  const { url, ...options } = requestConfig;
  const accessToken = getAccessToken();

  try {
    const response = await axios.request({
      url: `${BASE_URL}${url}`,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: accessToken ? `Bearer ${accessToken}` : undefined,
        ...options.headers,
      },
      responseType: 'blob', // Important: specify the response type as 'blob'
    });
    const blob = new Blob([response.data], { type: 'text/plain' });
    // Create a link element
    const link = document.createElement('a');

    // Set the download attribute with the desired file name
    link.href = window.URL.createObjectURL(blob);
    link.download = 'wallets.txt';

    // Append the link to the body
    document.body.appendChild(link);

    // Programmatically trigger a click on the link
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
  } catch (error: any) {
    const errMsg =
      error.response?.data.message ||
      error.response?.data.detail ||
      error.response?.data.error ||
      error.message;
    toast.error(errMsg);
    throw error;
  }
};
