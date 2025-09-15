import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Container,
  Stack,
  Group,
  Button,
  Text,
  ScrollArea,
  Paper,
  Badge,
  Divider,
  Alert,
  ActionIcon,
  Tooltip,
  Card,
  Box,
  Textarea,
  Collapse,
  Title,
  Breadcrumbs,
  Anchor,
  AppShell,
} from '@mantine/core';
import {
  IconSend,
  IconUser,
  IconRobot,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconSparkles,
  IconArrowLeft,
  IconHome,
  IconFileText,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { DocumentInput } from '@/api/knowledge';
import { useRouter } from 'next/navigation';
import KnowledgePointPreview from './KnowledgePointPreview';

interface DocumentChatPageProps {
  sessionId: string;
  filename: string;
  extractedTextPreview: string;
  onKnowledgePointsReady: (knowledgePoints: DocumentInput[]) => void;
  onShowDocumentViewer?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: Date;
  knowledgePoints?: DocumentInput[];
}

interface StreamChunk {
  type: 'reasoning' | 'content' | 'knowledge_points' | 'error' | 'done';
  data: any;
}



export default function DocumentChatPage({
  sessionId,
  filename,
  extractedTextPreview,
  onKnowledgePointsReady,
  onShowDocumentViewer,
}: DocumentChatPageProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentKnowledgePoints, setCurrentKnowledgePoints] = useState<DocumentInput[]>([]);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [isGeneratingJson, setIsGeneratingJson] = useState(false);
  const [showKnowledgePreview, setShowKnowledgePreview] = useState(false);
  const [fullExtractedText, setFullExtractedText] = useState<string>(extractedTextPreview);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('.mantine-ScrollArea-viewport');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    // 只在非流式输出状态下自动滚动
    if (!isStreaming) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isStreaming]);

  // 加载历史消息
  useEffect(() => {
    const loadHistoryMessages = async () => {
      try {
        console.log('Loading history messages for session:', sessionId);
        const response = await fetch(`/api/knowledge-base/chat-session/${sessionId}/messages`);

        if (response.ok) {
          const historyMessages = await response.json();
          console.log('History messages loaded:', historyMessages);

          // 转换格式为前端组件需要的格式
          const convertedMessages: ChatMessage[] = historyMessages.map((msg: any) => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            reasoning: msg.reasoning,
            timestamp: new Date(msg.timestamp),
            knowledgePoints: msg.knowledgePoints || []
          }));

          setMessages(convertedMessages);
          console.log('Set history messages:', convertedMessages.length, 'messages');

        } else {
          console.warn('Failed to load history messages:', response.status);
        }
      } catch (error) {
        console.warn('Error loading history messages:', error);
      }
    };

    loadHistoryMessages();
  }, [sessionId]);

  // 获取会话的完整提取文本
  useEffect(() => {
    const fetchFullText = async () => {
      try {
        console.log('Fetching session data for:', sessionId);

        // 首先获取session信息以获得document_id
        const sessionResponse = await fetch(`/api/knowledge-base/chat-session/${sessionId}`);
        if (!sessionResponse.ok) {
          console.error('Failed to fetch session data:', sessionResponse.status);
          setFullExtractedText(extractedTextPreview);
          return;
        }

        const sessionData = await sessionResponse.json();
        console.log('Session data received:', sessionData);

        if (sessionData.document_id) {
          // 使用document_id获取完整文档文本
          console.log('Fetching full document text for document_id:', sessionData.document_id);
          const documentResponse = await fetch(`/api/knowledge-base/documents/${sessionData.document_id}/full-text`);

          if (documentResponse.ok) {
            const documentData = await documentResponse.json();
            console.log('Document data received:', documentData);

            if (documentData.extracted_text) {
              setFullExtractedText(documentData.extracted_text);
              console.log('Loaded full extracted text:', documentData.extracted_text.length, 'characters');
              console.log('First 500 chars:', documentData.extracted_text.substring(0, 500));
            } else {
              console.warn('No extracted_text in document data, using preview');
              setFullExtractedText(extractedTextPreview);
            }
          } else {
            console.error('Failed to fetch document text:', documentResponse.status);
            setFullExtractedText(extractedTextPreview);
          }
        } else {
          console.warn('No document_id in session data, using preview');
          setFullExtractedText(extractedTextPreview);
        }
      } catch (error) {
        console.warn('Failed to fetch full text:', error);
        setFullExtractedText(extractedTextPreview);
      }
    };

    fetchFullText();
  }, [sessionId, extractedTextPreview]);


  // 调用后端解析知识点JSON
  const parseKnowledgePointsWithBackend = useCallback(async (jsonContent: string): Promise<DocumentInput[]> => {
    try {
      console.log('Calling backend JSON parsing API');
      console.log('JSON content length:', jsonContent.length);
      console.log('Session ID:', sessionId);

      const response = await fetch(`http://localhost:8000/api/knowledge-base/parse-json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json_content: jsonContent,
          session_id: sessionId
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend parsing failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error_message || 'Backend parsing failed');
      }

      console.log('Backend parsing successful');
      console.log('Parse method:', result.parse_method);
      console.log('Parsed knowledge points:', result.knowledge_points.length);

      // 转换为前端格式
      return result.knowledge_points.map((kp: any) => ({
        title: kp.title,
        description: kp.description,
        category: kp.category,
        examples: kp.examples,
        tags: kp.tags
      }));

    } catch (error) {
      console.error('Backend parsing failed:', error);
      throw error;
    }
  }, [sessionId]);

  // 处理流式数据块
  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
    switch (chunk.type) {
      case 'reasoning':
        setCurrentReasoning(prev => prev + chunk.data.reasoning);
        // 更新最后一条助手消息的reasoning
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.reasoning = chunk.data.full_reasoning || (lastMessage.reasoning + chunk.data.reasoning);
          }
          return newMessages;
        });
        break;

      case 'content':
        // 更新最后一条助手消息的content
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            const newContent = chunk.data.full_content || (lastMessage.content + chunk.data.content);
            lastMessage.content = newContent;
          }
          return newMessages;
        });

        // 检测是否开始生成JSON（只在第一次检测到时触发）
        const contentToCheck = chunk.data.full_content || chunk.data.content || '';
        if (contentToCheck.includes('```json') && !isGeneratingJson) {
          setIsGeneratingJson(true);
          console.log('Detected JSON generation start');
        }
        break;

      case 'knowledge_points':
        const knowledgePoints = chunk.data.knowledge_points as DocumentInput[];
        setCurrentKnowledgePoints(knowledgePoints);
        // 更新最后一条助手消息
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.knowledgePoints = knowledgePoints;
          }
          return newMessages;
        });
        toast.success(`AI 生成了 ${knowledgePoints.length} 个知识点`);
        break;

      case 'error':
        toast.error(`AI 处理出错: ${chunk.data.error}`);
        setIsStreaming(false);
        break;

      case 'done':
        setCurrentReasoning('');
        setIsStreaming(false);
        setIsGeneratingJson(false);

        // 流式结束时，尝试从最后一条消息的content中提取知识点
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
            // 异步解析知识点JSON
            (async () => {
              try {
                // 尝试从内容中提取JSON
                const jsonMatch = lastMessage.content.match(/```json\n([\s\S]*?)\n```/) ||
                                lastMessage.content.match(/\{[\s\S]*"knowledge_points"[\s\S]*\}/);
                if (jsonMatch) {
                  const jsonContent = jsonMatch[1] || jsonMatch[0];

                  console.log('Found JSON content, calling backend for parsing');

                  // 调用后端解析API
                  const knowledgePointsArray = await parseKnowledgePointsWithBackend(jsonContent);

                  if (knowledgePointsArray.length > 0) {
                    // 验证解析结果
                    knowledgePointsArray.forEach((kp, index) => {
                      console.log(`Knowledge Point ${index + 1}:`, {
                        title: kp.title,
                        description: kp.description?.substring(0, 100) + '...',
                        examples: kp.examples?.length || 0,
                        tags: kp.tags?.length || 0
                      });
                    });

                    // 更新状态
                    setCurrentKnowledgePoints(knowledgePointsArray);
                    lastMessage.knowledgePoints = knowledgePointsArray;
                    setShowKnowledgePreview(true);
                    toast.success(`AI 生成了 ${knowledgePointsArray.length} 个知识点`);

                    // 更新消息状态
                    setMessages(prev => {
                      const updatedMessages = [...prev];
                      const updatedLastMessage = updatedMessages[updatedMessages.length - 1];
                      if (updatedLastMessage && updatedLastMessage.id === lastMessage.id) {
                        updatedLastMessage.knowledgePoints = knowledgePointsArray;
                      }
                      return updatedMessages;
                    });
                  } else {
                    console.warn('No knowledge points were successfully parsed');
                    toast.warning('知识点解析失败，请检查AI输出格式');
                  }
                }
              } catch (e) {
                console.error('Failed to parse knowledge points:', e);
                toast.error('知识点解析失败：' + (e as Error).message);
              }
            })();
          }
          return newMessages;
        });
        break;
    }
  }, [isGeneratingJson, parseKnowledgePointsWithBackend]);

  // 通用的流式聊天函数
  const sendChatMessages = useCallback(async (newUserMessage?: string) => {
    if (isStreaming) return;

    // 准备消息列表
    let messagesToSend = [...messages];

    // 如果有新用户消息，添加到列表
    if (newUserMessage) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: newUserMessage,
        timestamp: new Date(),
      };
      messagesToSend.push(userMessage);
      setMessages(messagesToSend);
    }

    // 添加占位的助手消息
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      reasoning: '',
      timestamp: new Date(),
    };
    messagesToSend.push(assistantMessage);
    setMessages(messagesToSend);

    setIsStreaming(true);
    setCurrentReasoning('');

    try {
      // 转换消息格式为API需要的格式
      const apiMessages = messagesToSend
        .filter(msg => msg.role !== 'assistant' || msg.content.trim()) // 过滤空的助手消息
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          reasoning: msg.reasoning,
          timestamp: msg.timestamp.toISOString()
        }));

      console.log('Sending messages to API:', apiMessages);

      // 使用统一的流式聊天接口
      const response = await fetch(
        `http://localhost:8000/api/knowledge-base/chat-stream/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: apiMessages
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            const data = line.trim().slice(6);

            if (data === '[DONE]') {
              setIsStreaming(false);
              return;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);
              handleStreamChunk(chunk);
            } catch (e) {
              console.warn('Failed to parse chunk:', data);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in chat stream:', error);
      toast.error('发送消息失败，请重试');
      setIsStreaming(false);
    }
  }, [sessionId, isStreaming, messages, handleStreamChunk]);


  // 发送消息 - 重构为使用通用函数
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const messageText = inputMessage.trim();
    setInputMessage('');

    await sendChatMessages(messageText);
  }, [inputMessage, sendChatMessages, isStreaming]);



  // 处理键盘事件
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const breadcrumbItems = [
    { title: '首页', href: '/dashboard', icon: IconHome },
    { title: '知识库', href: '/dashboard/knowledge-base' },
    { title: 'AI 文档解析', href: '#' },
  ].map((item, index) => (
    <Anchor key={index} onClick={() => router.push(item.href)} size="sm">
      <Group gap="xs">
        {item.icon && <item.icon size={14} />}
        {item.title}
      </Group>
    </Anchor>
  ));

  return (
    <>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <Container size="xl" py="md" fluid>
        <Stack gap="lg">
        {/* 页面头部 */}
        <div>
          <Group justify="space-between" align="center" mb="sm">
            <Breadcrumbs separator=">">
              {breadcrumbItems}
            </Breadcrumbs>
            {onShowDocumentViewer && (
              <Tooltip label="查看完整文档内容">
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconFileText size={16} />}
                  onClick={onShowDocumentViewer}
                >
                  查看文档
                </Button>
              </Tooltip>
            )}
          </Group>
        </div>


        {/* 主要内容区域 */}
        <Paper withBorder p="lg" radius="md" style={{ 
          height: 'calc(100vh - 200px)',
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column'
        }}>
            <Stack gap="md" style={{ height: '100%' }}>
              <Text fw={600} size="lg">智能解析</Text>
              
              <ScrollArea 
                ref={scrollAreaRef} 
                style={{ flex: 1 }} 
                scrollbarSize={8}
                type="hover"
              >
                <Stack gap="md" pr="sm">
                  {messages.length === 0 && (
                    <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                      <Stack gap="md" align="center">
                        <IconSparkles size={64} color="var(--mantine-color-blue-6)" />
                        <Title order={3}>AI 文档分析</Title>
                        <Text ta="center" size="sm" c="dimmed" maw={400}>
                          点击下方按钮开始智能分析，或直接输入问题与AI对话
                        </Text>
                        <Button
                          size="lg"
                          leftSection={<IconSparkles size={20} />}
                          onClick={() => sendChatMessages("请分析文档并生成知识点")}
                          disabled={isStreaming}
                          loading={isStreaming}
                        >
                          开始 AI 分析
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {messages.map((message) => (
                    <Paper
                      key={message.id}
                      p="md"
                      withBorder
                      style={{
                        backgroundColor: message.role === 'user'
                          ? 'var(--mantine-color-blue-0)'
                          : 'var(--mantine-color-gray-0)',
                      }}
                    >
                      <Group gap="sm" align="flex-start">
                        <ActionIcon
                          variant="light"
                          color={message.role === 'user' ? 'blue' : 'green'}
                          size="lg"
                          style={{ marginTop: 4 }}
                        >
                          {message.role === 'user' ? <IconUser size={18} /> : <IconRobot size={18} />}
                        </ActionIcon>

                        <Stack gap="sm" style={{ flex: 1 }}>
                          <Group gap="sm">
                            <Text size="sm" fw={500}>
                              {message.role === 'user' ? '用户' : 'AI 助手'}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {message.timestamp.toLocaleTimeString()}
                            </Text>
                          </Group>

                          {/* AI 思考过程 */}
                          {message.role === 'assistant' && (message.reasoning || currentReasoning) && (
                            <Text 
                              size="sm" 
                              c="dimmed" 
                              style={{ 
                                whiteSpace: 'pre-wrap', 
                                lineHeight: 1.5,
                                fontStyle: 'italic',
                                marginBottom: 'var(--mantine-spacing-sm)'
                              }}
                            >
                              {/* 流式过程中优先显示实时状态，否则显示存储的内容 */}
                              {isStreaming && message === messages[messages.length - 1]
                                ? currentReasoning
                                : message.reasoning
                              }
                              {isStreaming && message === messages[messages.length - 1] && currentReasoning && (
                                <Text 
                                  component="span" 
                                  c="yellow.7" 
                                  fw={700}
                                  style={{ 
                                    animation: 'blink 1s infinite',
                                    '@keyframes blink': {
                                      '0%, 50%': { opacity: 1 },
                                      '51%, 100%': { opacity: 0 }
                                    }
                                  }}
                                >
                                  ▋
                                </Text>
                              )}
                            </Text>
                          )}

                          {/* 消息内容 */}
                          {message.content && (
                            <Text style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                              {message.content}
                              {isStreaming && message === messages[messages.length - 1] && (
                                <Text 
                                  component="span" 
                                  c="blue.6" 
                                  fw={700}
                                  style={{ 
                                    animation: 'blink 1s infinite',
                                    '@keyframes blink': {
                                      '0%, 50%': { opacity: 1 },
                                      '51%, 100%': { opacity: 0 }
                                    }
                                  }}
                                >
                                  ▋
                                </Text>
                              )}
                            </Text>
                          )}

                          {/* JSON生成进度提示 */}
                          {message.role === 'assistant' && 
                           message === messages[messages.length - 1] && 
                           isGeneratingJson && 
                           isStreaming && (
                            <Alert icon={<IconSparkles size={16} />} color="blue">
                              <Group gap="sm">
                                <Text size="sm" fw={500}>正在生成知识点...</Text>
                                <div style={{ 
                                  width: 16, 
                                  height: 16, 
                                  border: '2px solid var(--mantine-color-blue-3)',
                                  borderTop: '2px solid var(--mantine-color-blue-6)',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }} />
                              </Group>
                              <Text size="xs" c="dimmed" mt="xs">
                                AI 正在分析文档内容并生成结构化的数学知识点
                              </Text>
                            </Alert>
                          )}

                          {/* 知识点预览 */}
                          {message.knowledgePoints && message.knowledgePoints.length > 0 && (
                            <Alert 
                              icon={<IconCheck size={16} />} 
                              color="green"
                              style={{ 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: '1px solid var(--mantine-color-green-3)'
                              }}
                              onClick={() => {
                                setCurrentKnowledgePoints(message.knowledgePoints || []);
                                setShowKnowledgePreview(true);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--mantine-color-green-1)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '';
                                e.currentTarget.style.transform = '';
                                e.currentTarget.style.boxShadow = '';
                              }}
                            >
                              <Group justify="space-between" align="flex-start">
                                <div style={{ flex: 1 }}>
                                  <Group gap="sm" mb="xs">
                                    <Text size="sm" fw={500}>
                                      生成了 {message.knowledgePoints.length} 个知识点
                                    </Text>
                                    <Badge variant="light" color="blue" size="sm">
                                      点击查看详情
                                    </Badge>
                                  </Group>
                                  <Group gap="xs" wrap="wrap">
                                    {message.knowledgePoints.slice(0, 5).map((kp, index) => (
                                      <Badge key={index} variant="light" size="sm">
                                        {kp.title}
                                      </Badge>
                                    ))}
                                    {message.knowledgePoints.length > 5 && (
                                      <Badge variant="outline" size="sm" c="dimmed">
                                        +{message.knowledgePoints.length - 5} 更多...
                                      </Badge>
                                    )}
                                  </Group>
                                </div>
                                <ActionIcon 
                                  variant="subtle" 
                                  color="green"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentKnowledgePoints(message.knowledgePoints || []);
                                    setShowKnowledgePreview(true);
                                  }}
                                >
                                  <IconSparkles size={16} />
                                </ActionIcon>
                              </Group>
                            </Alert>
                          )}
                        </Stack>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>

              <Divider />

              {/* 输入区域 */}
              <Group align="flex-end" gap="sm">
                <Textarea
                  placeholder="输入消息..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.currentTarget.value)}
                  onKeyDown={handleKeyPress}
                  minRows={2}
                  maxRows={4}
                  style={{ flex: 1 }}
                  disabled={isStreaming}
                />
                <Tooltip label="发送消息 (Enter)">
                  <ActionIcon
                    size="xl"
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isStreaming}
                    loading={isStreaming}
                    variant="filled"
                  >
                    <IconSend size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Stack>
          </Paper>
      </Stack>
      
      {/* 知识点预览和编辑 */}
      {showKnowledgePreview && currentKnowledgePoints.length > 0 && (
        <KnowledgePointPreview
          opened={showKnowledgePreview}
          onClose={() => setShowKnowledgePreview(false)}
          filename={filename}
          extractedText={fullExtractedText}
          knowledgePoints={currentKnowledgePoints}
          onSuccess={() => {
            onKnowledgePointsReady(currentKnowledgePoints);
            setShowKnowledgePreview(false);
            router.push('/dashboard/knowledge-base');
          }}
        />
      )}
      </Container>
    </>
  );
}
