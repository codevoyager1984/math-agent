import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import type { UIMessage, UIMessagePart } from 'ai';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { searchKnowledgePoints } from '@/lib/ai/tools/search-knowledge-points';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { ChatModel } from '@/lib/ai/models';
import type { VisibilityType } from '@/components/visibility-selector';
import { Session } from 'next-auth';
import { deepseek } from '@ai-sdk/deepseek';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

// Helper function to filter out image attachments for DeepSeek models
function filterImageAttachments(messages: UIMessage[]): UIMessage[] {
  let filteredImageCount = 0;
  
  const filtered = messages.map(message => ({
    ...message,
    parts: message.parts.filter(part => {
      // Keep text parts and non-file parts
      if (part.type !== 'file') {
        return true;
      }
      
      // Filter out image files
      const isImage = part.mediaType?.startsWith('image/');
      if (isImage) {
        filteredImageCount++;
        console.log(`🖼️ 过滤图片文件: ${(part as any).name || 'unknown'} (${part.mediaType})`);
      }
      
      return !isImage;
    })
  }));
  
  if (filteredImageCount > 0) {
    console.log(`🖼️ 总计过滤了 ${filteredImageCount} 个图片附件（DeepSeek 不支持图片）`);
  }
  
  return filtered;
}

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  // Generate request ID for tracking the entire flow
  const requestId = generateUUID().slice(0, 8);
  const startTime = Date.now();
  
  console.log(`[${requestId}] Chat API request started`);
  
  let requestBody: PostRequestBody;

  try {
    console.log(`[${requestId}] Parsing request body`);
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
    console.log(`[${requestId}] Request body parsed successfully:`, {
      id: requestBody.id,
      messageId: requestBody.message?.id,
      model: requestBody.selectedChatModel,
      visibility: requestBody.selectedVisibilityType,
      messagePartsCount: requestBody.message?.parts?.length || 0
    });
  } catch (error) {
    console.error(`[${requestId}] Failed to parse request body:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestHeaders: Object.fromEntries(request.headers.entries()),
      url: request.url,
      method: request.method
    });
    return new ChatSDKError('bad_request:api').toResponse();
  }

  // Extract variables outside try block for error logging
  let id: string | undefined;
  let selectedChatModel: ChatModel['id'] | undefined;
  let session: Session | null = null;

  try {
    const requestData: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel['id'];
      selectedVisibilityType: VisibilityType;
    } = requestBody;
    
    id = requestData.id;
    selectedChatModel = requestData.selectedChatModel;
    const { message, selectedVisibilityType } = requestData;

    console.log(`[${requestId}] Authenticating user`);
    const authStart = Date.now();
    session = await auth();
    console.log(`[${requestId}] Authentication completed in ${Date.now() - authStart}ms`);

    if (!session?.user) {
      console.warn(`[${requestId}] Unauthorized access attempt`);
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;
    console.log(`[${requestId}] Authenticated user:`, {
      userId: session.user.id,
      userType,
      chatId: id
    });

    console.log(`[${requestId}] Checking rate limits`);
    const rateLimitStart = Date.now();
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });
    console.log(`[${requestId}] Rate limit check completed in ${Date.now() - rateLimitStart}ms`, {
      messageCount,
      maxAllowed: entitlementsByUserType[userType].maxMessagesPerDay,
      userType
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      console.warn(`[${requestId}] Rate limit exceeded:`, {
        userId: session.user.id,
        messageCount,
        maxAllowed: entitlementsByUserType[userType].maxMessagesPerDay
      });
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    console.log(`[${requestId}] Loading chat data`);
    const chatLoadStart = Date.now();
    const chat = await getChatById({ id });
    console.log(`[${requestId}] Chat data loaded in ${Date.now() - chatLoadStart}ms`, {
      chatExists: !!chat,
      chatUserId: chat?.userId
    });

    if (!chat) {
      console.log(`[${requestId}] Creating new chat`);
      const titleStart = Date.now();
      const title = await generateTitleFromUserMessage({
        message,
      });
      console.log(`[${requestId}] Title generated in ${Date.now() - titleStart}ms: "${title}"`);

      const saveChatStart = Date.now();
      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
      console.log(`[${requestId}] New chat saved in ${Date.now() - saveChatStart}ms`);
    } else {
      if (chat.userId !== session.user.id) {
        console.warn(`[${requestId}] Forbidden chat access:`, {
          chatId: id,
          chatUserId: chat.userId,
          requestUserId: session.user.id
        });
        return new ChatSDKError('forbidden:chat').toResponse();
      }
      console.log(`[${requestId}] Using existing chat`);
    }

    console.log(`[${requestId}] Loading chat messages`);
    const messagesStart = Date.now();
    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];
    console.log(`[${requestId}] Messages loaded in ${Date.now() - messagesStart}ms`, {
      dbMessagesCount: messagesFromDb.length,
      totalUIMessagesCount: uiMessages.length
    });
    
    // Filter out image attachments for DeepSeek models (they don't support images)
    console.log(`[${requestId}] Filtering image attachments for DeepSeek compatibility`);
    const filterStart = Date.now();
    const filteredMessages = filterImageAttachments(uiMessages);
    
    // Log filtering info for debugging
    const originalPartsCount = uiMessages.reduce((acc, msg) => acc + msg.parts.length, 0);
    const filteredPartsCount = filteredMessages.reduce((acc, msg) => acc + msg.parts.length, 0);
    
    console.log(`[${requestId}] Message filtering completed in ${Date.now() - filterStart}ms`, {
      originalPartsCount,
      filteredPartsCount,
      removedParts: originalPartsCount - filteredPartsCount
    });
    
    if (originalPartsCount !== filteredPartsCount) {
      console.log(`[${requestId}] 🖼️ 已过滤图片附件: ${originalPartsCount - filteredPartsCount} 个图片部分被移除`);
    }

    console.log(`[${requestId}] Processing geolocation and request hints`);
    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };
    
    console.log(`[${requestId}] Geolocation extracted:`, {
      longitude,
      latitude,
      city,
      country
    });

    // Fetch existing knowledge point names for enhanced system prompt
    console.log(`[${requestId}] Fetching existing knowledge point names`);
    let existingKnowledgePoints: string[] = [];
    try {
      const ragServerUrl = process.env.RAG_SERVER_URL || 'http://localhost:8000';
      const knowledgeResponse = await fetch(`${ragServerUrl}/api/knowledge-base/names`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      if (knowledgeResponse.ok) {
        const knowledgeData = await knowledgeResponse.json();
        existingKnowledgePoints = knowledgeData.names || [];
        console.log(`[${requestId}] Retrieved ${existingKnowledgePoints.length} existing knowledge point names`);
      } else {
        console.warn(`[${requestId}] Failed to fetch knowledge point names: ${knowledgeResponse.status}`);
      }
    } catch (error) {
      console.warn(`[${requestId}] Error fetching knowledge point names:`, error);
      // Continue without knowledge point names - don't break the chat flow
    }

    // Extract attachment info from file parts for storage
    console.log(`[${requestId}] Processing message attachments`);
    const attachments = message.parts
      .filter(part => part.type === 'file')
      .map(part => ({
        name: (part as any).name || 'unknown',
        url: part.url,
        contentType: part.mediaType || 'application/octet-stream',
      }));
    
    console.log(`[${requestId}] Found ${attachments.length} attachments:`, 
      attachments.map(att => ({ name: att.name, contentType: att.contentType })));

    // Save the original message with attachments for UI display
    console.log(`[${requestId}] Saving user message to database`);
    const saveMessageStart = Date.now();
    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts, // Keep original parts including images
          attachments, // Store attachment metadata
          createdAt: new Date(),
        },
      ],
    });
    console.log(`[${requestId}] User message saved in ${Date.now() - saveMessageStart}ms`);

    console.log(`[${requestId}] Setting up streaming`);
    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });
    console.log(`[${requestId}] Stream ID created: ${streamId}`);

    console.log(`[${requestId}] Creating UI message stream with model: ${selectedChatModel}`);
    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        console.log(`[${requestId}] Starting text streaming execution`);
        
        try {
          const modelMessages = convertToModelMessages(filteredMessages);
          console.log(`[${requestId}] Converted to model messages:`, {
            messageCount: modelMessages.length,
            model: selectedChatModel,
            activeTools: ['searchKnowledgePoints'],
            telemetryEnabled: isProductionEnvironment
          });
          
          const result = streamText({
            model: myProvider.languageModel(selectedChatModel!),
            system: systemPrompt({
              selectedChatModel: selectedChatModel!,
              requestHints,
              existingKnowledgePoints
            }),
            messages: modelMessages,
            stopWhen: stepCountIs(5),
            experimental_activeTools: ['searchKnowledgePoints'],
            // experimental_activeTools:
            //   selectedChatModel === 'chat-model-reasoning'
            //     ? []
            //     : [
            //         'getWeather',
            //         'createDocument',
            //         'updateDocument',
            //         'requestSuggestions',
            //       ],
            experimental_transform: smoothStream({ chunking: 'word' }),
            tools: {
              // getWeather,
              // createDocument: createDocument({ session: session!, dataStream }),
              // updateDocument: updateDocument({ session: session!, dataStream }),
              // requestSuggestions: requestSuggestions({
              //   session: session!,
              //   dataStream,
              // }),
              searchKnowledgePoints: searchKnowledgePoints({
                session: session!,
                dataStream,
              }),
            },
            experimental_telemetry: {
              isEnabled: isProductionEnvironment,
              functionId: 'stream-text',
            },
          });

          console.log(`[${requestId}] StreamText result created, consuming stream`);
          result.consumeStream();

          console.log(`[${requestId}] Merging result stream with data stream`);
          dataStream.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            }),
          );
          
          console.log(`[${requestId}] Stream execution setup completed`);
        } catch (error) {
          console.error(`[${requestId}] Error in stream execution:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            model: selectedChatModel,
            messageCount: filteredMessages.length
          });
          throw error;
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        console.log('messages', messages);
        console.log(`[${requestId}] Stream finished, saving ${messages.length} AI messages`);
        const saveAIStart = Date.now();
        
        try {
          await saveMessages({
            messages: messages.map((message) => ({
              id: message.id,
              role: message.role,
              parts: message.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id!,
            })),
          });
          
          console.log(`[${requestId}] AI messages saved in ${Date.now() - saveAIStart}ms`);
          
          const totalTime = Date.now() - startTime;
          console.log(`[${requestId}] Chat request completed successfully in ${totalTime}ms`);
        } catch (error) {
          console.error(`[${requestId}] Error saving AI messages:`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            messageCount: messages.length,
            chatId: id!
          });
          throw error;
        }
      },
      onError: (error) => {
        console.error(`[${requestId}] Stream error occurred:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          streamId,
          chatId: id!,
          model: selectedChatModel!,
          timestamp: new Date().toISOString()
        });
        return 'Oops, an error occurred!';
      },
    });

    console.log(`[${requestId}] Setting up stream response`);
    const streamContext = getStreamContext();

    if (streamContext) {
      console.log(`[${requestId}] Using resumable stream context`);
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      console.log(`[${requestId}] Using direct stream response`);
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    if (error instanceof ChatSDKError) {
      console.error(`[${requestId}] ChatSDKError after ${totalTime}ms:`, {
        errorCode: error.message,
        requestId,
        chatId: id,
        userId: session?.user?.id,
        model: selectedChatModel
      });
      return error.toResponse();
    }

    console.error(`[${requestId}] Unhandled error in chat API after ${totalTime}ms:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError',
      requestId,
      chatId: id,
      userId: session?.user?.id,
      model: selectedChatModel,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin')
    });
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  // Generate request ID for tracking the entire flow
  const requestId = generateUUID().slice(0, 8);
  const startTime = Date.now();
  
  console.log(`[${requestId}] Chat DELETE request started`);
  
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log(`[${requestId}] Delete request for chat ID: ${id}`);

    if (!id) {
      console.warn(`[${requestId}] DELETE request missing chat ID`);
      return new ChatSDKError('bad_request:api').toResponse();
    }

    console.log(`[${requestId}] Authenticating user for DELETE`);
    const authStart = Date.now();
    const session = await auth();
    console.log(`[${requestId}] Authentication completed in ${Date.now() - authStart}ms`);

    if (!session?.user) {
      console.warn(`[${requestId}] Unauthorized DELETE attempt for chat: ${id}`);
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    console.log(`[${requestId}] Loading chat for deletion check`, {
      chatId: id,
      userId: session.user.id
    });

    const chatLoadStart = Date.now();
    const chat = await getChatById({ id });
    console.log(`[${requestId}] Chat loaded in ${Date.now() - chatLoadStart}ms`, {
      chatExists: !!chat,
      chatUserId: chat?.userId
    });

    if (chat.userId !== session.user.id) {
      console.warn(`[${requestId}] Forbidden chat deletion attempt:`, {
        chatId: id,
        chatUserId: chat.userId,
        requestUserId: session.user.id
      });
      return new ChatSDKError('forbidden:chat').toResponse();
    }

    console.log(`[${requestId}] Deleting chat`);
    const deleteStart = Date.now();
    const deletedChat = await deleteChatById({ id });
    console.log(`[${requestId}] Chat deleted in ${Date.now() - deleteStart}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] DELETE request completed successfully in ${totalTime}ms`);

    return Response.json(deletedChat, { status: 200 });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    console.error(`[${requestId}] Error in DELETE chat API after ${totalTime}ms:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'UnknownError',
      requestId,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin')
    });
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new ChatSDKError('offline:chat').toResponse();
  }
}
