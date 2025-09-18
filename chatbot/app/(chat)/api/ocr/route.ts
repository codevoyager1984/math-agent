import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { logError, createErrorResponse } from '@/lib/api-error-handler';

// Helper function to get MIME type from URL
function getImageMimeType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return mimeTypes[extension || ''] || 'image/jpeg';
}

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = getImageMimeType(imageUrl);
    
    return { base64, mimeType };
  } catch (error) {
    throw new Error(`Failed to fetch and encode image: ${error}`);
  }
}

export async function POST(request: Request) {
  console.log('ocr request');
  const endpoint = '/api/ocr';
  const method = 'POST';

  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user?.id;
    console.log('userId', userId);
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Get API key from environment variables
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Fetch image and convert to base64
    console.log(`🚀 正在获取并编码图片: ${imageUrl}`);
    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
    console.log(`✅ 图片编码完成，MIME类型: ${mimeType}, Base64长度: ${base64.length}`);

    // Prepare the request to OpenRouter API with base64 encoded image
    const ocrPayload = {
      model: "doubao-seed-1-6-vision-250815",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              }
            },
            {
              type: "text",
              text: "请识别下图片里面的主体内容，请直接返回完整的内容，不需要做过多解释。有换行的地方注意需要换行。"
            },
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1,
      thinking: {
        type: "disabled"
      }
    };

    console.log(`🚀 正在使用 GPT-5 识别图片文字...`);
    console.log('⏳ 请稍等...');
    
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ocrPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log(`🔴 API request failed: ${response.status}`);
      console.log(`🔴 API error data: ${JSON.stringify(errorData)}`);
      const errorMessage = errorData.error?.message || `API request failed: ${response.status}`;
      console.log(`🔴 Error message: ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const result = await response.json();

    console.log(`🔴 API response: ${JSON.stringify(result.choices[0].message)}`);

    if (result.choices && result.choices.length > 0) {
      const content = result.choices[0].message.content;
      
      console.log(`✅ 识别成功!`);
      console.log(`📝 识别结果: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      console.log(`🤖 使用模型: ${result.model || 'openai/gpt-5'}`);
      
      if (result.usage) {
        console.log(`💰 Token使用情况:`);
        console.log(`   输入: ${result.usage.prompt_tokens || 0}`);
        console.log(`   输出: ${result.usage.completion_tokens || 0}`);
        console.log(`   总计: ${result.usage.total_tokens || 0}`);
      }
      
      return NextResponse.json({
        success: true,
        text: content,
        model: result.model || 'openai/gpt-5',
        usage: result.usage || {}
      });
    } else {
      console.log(`❌ API响应中没有找到内容`);
      return NextResponse.json({ error: 'No content found in API response' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ OCR API 错误:', error);
    
    // Get session for error logging if possible
    let userId: string | undefined;
    try {
      const session = await auth();
      userId = session?.user?.id;
    } catch {
      // Ignore auth errors in error handler
    }

    return createErrorResponse(error, {
      endpoint,
      method,
      userId,
      requestBody: 'OCR request'
    });
  }
}
