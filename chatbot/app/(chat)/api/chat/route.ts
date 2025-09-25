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
import type { ModelMessage, ToolCallPart, UIMessage, UIMessagePart } from 'ai';
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

export const maxDuration = 600; // 10 minutes

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

// Helper function to clean up incomplete tool calls from model messages
function cleanupIncompleteToolCalls(messages: ModelMessage[]): ModelMessage[] {
  const cleanedMessages: ModelMessage[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (message.role === 'assistant') {
      // Handle both string and array content
      if (typeof message.content === 'string') {
        // String content has no tool calls, keep as is
        cleanedMessages.push(message);
        continue;
      }
      
      // Check if this assistant message has tool calls
      const toolCalls = message.content.filter((part: any) => part.type === 'tool-call') as ToolCallPart[];
      
      if (toolCalls.length > 0) {
        // Find all tool response messages that follow this assistant message
        const toolResponses = new Set<string>();
        
        // Look ahead to find tool responses
        for (let j = i + 1; j < messages.length; j++) {
          const nextMessage = messages[j];
          if (nextMessage.role === 'tool') {
            const toolResult = Array.isArray(nextMessage.content) ? nextMessage.content[0] : null;
            if (toolResult && toolResult.type === 'tool-result') {
              toolResponses.add(toolResult.toolCallId);
            }
          } else if (nextMessage.role === 'assistant' || nextMessage.role === 'user') {
            // Stop looking when we hit another assistant or user message
            break;
          }
        }
        
        // Filter out tool calls that don't have corresponding responses
        const validToolCalls = toolCalls.filter(toolCall => toolResponses.has(toolCall.toolCallId));
        const otherContent = message.content.filter((part: any) => part.type !== 'tool-call');
        
        if (validToolCalls.length !== toolCalls.length) {
          console.log(`🔧 清理不完整的 tool calls: 移除了 ${toolCalls.length - validToolCalls.length} 个没有响应的 tool call`);
        }
        
        // Only include the message if it has valid content (text or valid tool calls)
        if (otherContent.length > 0 || validToolCalls.length > 0) {
          cleanedMessages.push({
            ...message,
            content: [...otherContent, ...validToolCalls]
          });
        }
      } else {
        // No tool calls, keep the message as is
        cleanedMessages.push(message);
      }
    } else {
      // Non-assistant messages, keep as is
      cleanedMessages.push(message);
    }
  }
  
  return cleanedMessages;
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

    let thingStreamFinished = false;
    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        console.log(`[${requestId}] Starting text streaming execution`);

        try {
          const rawModelMessages = convertToModelMessages(filteredMessages);
          const modelMessages = cleanupIncompleteToolCalls(rawModelMessages);
          
          console.log(`[${requestId}] Converted to model messages:`, {
            messageCount: modelMessages.length,
            model: selectedChatModel,
            activeTools: selectedChatModel === 'chat-model-reasoning' ? [] : ['searchKnowledgePoints'],
            telemetryEnabled: isProductionEnvironment
          });
          
          if (rawModelMessages.length !== modelMessages.length) {
            console.log(`[${requestId}] 🔧 清理后消息数量变化: ${rawModelMessages.length} -> ${modelMessages.length}`);
          }
          
          console.log(`[${requestId}] Model messages:`, JSON.stringify(modelMessages, null, 2));

          // Two-stage processing for reasoning model
          if (selectedChatModel === 'chat-model-reasoning') {
            console.log(`[${requestId}] Starting two-stage reasoning process`);

            let reasoningText = '';
            let reasoningFinished = false;

            try {
              // Send reasoning-start event
              const reasoningId = generateUUID();
              dataStream.merge(
                createUIMessageStream({
                  execute: async ({ writer }) => {
                    writer.write({
                      type: 'reasoning-start',
                      id: reasoningId,
                    });
                  },
                  generateId: generateUUID,
                })
              );

              // Stage 1: Get reasoning without streaming to UI
              console.log(`[${requestId}] Stage 1: Deep thinking with reasoner model`);
              const reasoningMessages = modelMessages.filter(x => x.role !== 'tool').map(x => {
                if (x.role !== 'assistant') {
                  return x;
                }
                const {role, content} = x;
                const filteredContent = [];
                for (const part of content) {
                  if ((part as ToolCallPart).type === 'tool-call') {
                    // Remove tool calls for reasoning stage
                  } else {
                    filteredContent.push(part);
                  }
                }
                return {role, content: filteredContent};
              });
              console.log(`[${requestId}] Stage 1: Model messages:`, JSON.stringify(reasoningMessages, null, 2));
              const reasoningResult = streamText({
                model: myProvider.languageModel('chat-model-reasoning'),
                system: `你是一个专业的数学问题分析专家。请仔细分析用户的问题，制定详细的解决方案。

分析时请考虑：
1. 问题的核心要求和难点
2. 需要的数学知识点和公式
3. 解题的步骤和方法
4. 最佳的回答策略和结构

格式要求：
1. 思考过程所有公式必须使用 latex 格式
2. 有换行的地方注意需要换行

现有的知识库包含以下知识点：
${existingKnowledgePoints.join(', ')}

请详细思考如何最好地解答用户的问题。`,
                messages: reasoningMessages as ModelMessage[],
                abortSignal: request.signal,
                experimental_telemetry: {
                  isEnabled: isProductionEnvironment,
                  functionId: 'reasoning-stage',
                },
                onChunk: (chunk) => {
                  if (reasoningFinished) return; // 避免重复处理
                  
                  const chunkType = chunk.chunk.type;
                  if (chunkType === 'reasoning-delta') {
                    const reasoningDelta = chunk?.chunk?.text;
                    if (reasoningDelta) {
                      reasoningText += reasoningDelta;
                      // 实时流式发送推理内容到前端
                      dataStream.merge(
                        createUIMessageStream({
                          execute: async ({ writer }) => {
                            writer.write({
                              type: 'reasoning-delta',
                              id: reasoningId,
                              delta: reasoningDelta,
                            });
                          },
                          generateId: generateUUID,
                        })
                      );
                    }
                  }
                  if (chunkType === 'text-delta') {
                    reasoningFinished = true;
                    console.log(`[${requestId}] Stage 1 reasoning completed, total length: ${reasoningText.length}`);
                  }
                },
                onError: (error) => {
                  console.error(`[${requestId}] Stage 1 reasoning error:`, error);
                  reasoningFinished = true;
                }
              });

              // Consume the reasoning stream to trigger onChunk callbacks
              console.log(`[${requestId}] Consuming reasoning stream`);
              reasoningResult.consumeStream();

              // Wait for reasoning to complete with timeout (max 10 minutes)
              const reasoningTimeout = 60 * 60 * 1000; // 10 minutes in milliseconds
              const startTime = Date.now();
              
              while (!reasoningFinished && !thingStreamFinished) {
                const elapsed = Date.now() - startTime;
                if (elapsed >= reasoningTimeout) {
                  console.log(`[${requestId}] Reasoning timeout reached (10 minutes), proceeding to next stage`);
                  reasoningFinished = true;
                  break;
                }
                console.log(`[${requestId}] Waiting for reasoning to finish (${Math.floor(elapsed / 1000)}s elapsed)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }

              if (thingStreamFinished) {
                console.log(`[${requestId}] Stream finished, skipping rest of the process`);
                return;
              }

              // Send reasoning-end event
              dataStream.merge(
                createUIMessageStream({
                  execute: async ({ writer }) => {
                    writer.write({
                      type: 'reasoning-end',
                      id: reasoningId,
                    });
                  },
                  generateId: generateUUID,
                })
              );

              console.log(`[${requestId}] Stage 1 completed, reasoning length: ${reasoningText.length}`);

              // Stage 2: Execute with tools and stream everything (reasoning + response)
              console.log(`[${requestId}] Stage 2: Executing with tools based on reasoning`);
              const enhancedSystemPrompt = systemPrompt({
                selectedChatModel: 'chat-model', // Use regular chat model for stage 2
                requestHints,
                existingKnowledgePoints,
                reasoningContext: reasoningText // Pass reasoning as context
              });

              console.log(`[${requestId}] Enhanced system prompt:`, enhancedSystemPrompt);

              const result = streamText({
                model: myProvider.languageModel('chat-model'),
                system: enhancedSystemPrompt,
                messages: modelMessages,
                stopWhen: stepCountIs(5),
                experimental_activeTools: ['searchKnowledgePoints'],
                experimental_transform: smoothStream({ chunking: 'word' }),
                abortSignal: request.signal,
                tools: {
                  searchKnowledgePoints: searchKnowledgePoints({
                    session: session!,
                    dataStream,
                  }),
                },
                experimental_telemetry: {
                  isEnabled: isProductionEnvironment,
                  functionId: 'action-stage',
                },
              });

              console.log(`[${requestId}] Two-stage StreamText result created, consuming stream`);
              result.consumeStream();

              console.log(`[${requestId}] Streaming response (reasoning already streamed)`);

              // Merge the main response stream (reasoning was already streamed incrementally)
              dataStream.merge(
                result.toUIMessageStream({
                  sendReasoning: false,
                })
              );

            } catch (error) {
              console.error(`[${requestId}] Two-stage reasoning failed, falling back to single-stage:`, {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                reasoningLength: reasoningText.length
              });

              // Fallback to single-stage processing with regular chat model
              console.log(`[${requestId}] Fallback: Using single-stage chat-model processing`);

              const result = streamText({
                model: myProvider.languageModel('chat-model'),
                system: systemPrompt({
                  selectedChatModel: 'chat-model',
                  requestHints,
                  existingKnowledgePoints
                }),
                messages: modelMessages,
                stopWhen: stepCountIs(5),
                experimental_activeTools: ['searchKnowledgePoints'],
                experimental_transform: smoothStream({ chunking: 'word' }),
                abortSignal: request.signal,
                tools: {
                  searchKnowledgePoints: searchKnowledgePoints({
                    session: session!,
                    dataStream,
                  }),
                },
                experimental_telemetry: {
                  isEnabled: isProductionEnvironment,
                  functionId: 'stream-text-fallback',
                },
              });

              console.log(`[${requestId}] Fallback StreamText result created, consuming stream`);
              result.consumeStream();

              console.log(`[${requestId}] Merging fallback result stream with data stream`);
              dataStream.merge(
                result.toUIMessageStream({
                  sendReasoning: true,
                }),
              );
            }

          } else {
            // Single-stage processing for regular models
            console.log(`[${requestId}] Single-stage processing with model: ${selectedChatModel}`);

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
              experimental_transform: smoothStream({ chunking: 'word' }),
              abortSignal: request.signal,
              tools: {
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
          }
          
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
        thingStreamFinished = true;
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
        thingStreamFinished = true;
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
