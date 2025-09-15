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
  IconBrain,
  IconCheck,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
  IconSparkles,
  IconArrowLeft,
  IconHome,
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
}: DocumentChatPageProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentKnowledgePoints, setCurrentKnowledgePoints] = useState<DocumentInput[]>([]);
  const [isInitialGeneration, setIsInitialGeneration] = useState(true);
  const [showExtractedText, setShowExtractedText] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [showReasoning, setShowReasoning] = useState(true);
  const [isGeneratingJson, setIsGeneratingJson] = useState(false);
  const [showKnowledgePreview, setShowKnowledgePreview] = useState(false);

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
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
            
            // 检测是否开始生成JSON
            if (newContent.includes('```json') && !isGeneratingJson) {
              setIsGeneratingJson(true);
              console.log('Detected JSON generation start');
            }
          }
          return newMessages;
        });
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
            try {
              // 尝试解析JSON格式的知识点
              const jsonMatch = lastMessage.content.match(/```json\n([\s\S]*?)\n```/) || 
                              lastMessage.content.match(/\{[\s\S]*"knowledge_points"[\s\S]*\}/);
              if (jsonMatch) {
                const jsonContent = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                let knowledgePointsArray = null;
                
                // 处理不同的JSON格式
                if (Array.isArray(jsonContent)) {
                  knowledgePointsArray = jsonContent;
                } else if (jsonContent.knowledge_points && Array.isArray(jsonContent.knowledge_points)) {
                  knowledgePointsArray = jsonContent.knowledge_points;
                }
                
                if (knowledgePointsArray && knowledgePointsArray.length > 0) {
                  console.log('Extracted knowledge points on done:', knowledgePointsArray);
                  setCurrentKnowledgePoints(knowledgePointsArray);
                  lastMessage.knowledgePoints = knowledgePointsArray;
                  setShowKnowledgePreview(true);
                  toast.success(`AI 生成了 ${knowledgePointsArray.length} 个知识点`);
                }
              }
            } catch (e) {
              console.debug('Failed to parse knowledge points on done:', e);
            }
          }
          return newMessages;
        });
        break;
    }
  }, []);

  // 开始初始知识点生成
  const startInitialGeneration = useCallback(async () => {
    if (isStreaming) return;

    setIsStreaming(true);
    setCurrentReasoning('');
    setIsInitialGeneration(false);

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: '请分析这个文档并生成知识点',
      timestamp: new Date(),
    };
    setMessages([userMessage]);

    // 添加一个占位的助手消息
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      reasoning: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 发起流式请求
      const response = await fetch(
        `http://localhost:8000/api/knowledge-base/chat-stream/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: '请分析这个文档并生成知识点',
            message_type: 'initial_generation',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // 创建 SSE 连接
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理完整的行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

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
      console.error('Error in initial generation:', error);
      toast.error('初始生成失败，请重试');
      setIsStreaming(false);
    }
  }, [sessionId, isStreaming, handleStreamChunk]);

  // 发送消息
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsStreaming(true);
    setCurrentReasoning('');

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // 添加占位的助手消息
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      reasoning: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/knowledge-base/chat-stream/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageText,
            message_type: 'text',
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
      console.error('Error sending message:', error);
      toast.error('发送消息失败，请重试');
      setIsStreaming(false);
    }
  }, [inputMessage, sessionId, isStreaming, handleStreamChunk]);

  // 确认知识点
  const handleConfirmKnowledgePoints = useCallback(() => {
    if (currentKnowledgePoints.length > 0) {
      onKnowledgePointsReady(currentKnowledgePoints);
      router.push('/dashboard/knowledge-base');
    } else {
      toast.error('还没有生成知识点');
    }
  }, [currentKnowledgePoints, onKnowledgePointsReady, router]);

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
          <Breadcrumbs separator=">" mb="sm">
            {breadcrumbItems}
          </Breadcrumbs>
        </div>

        {/* 提取文本预览 */}
        <Collapse in={showExtractedText}>
          <Alert icon={<IconInfoCircle size={16} />} color="gray">
            <Stack gap="xs">
              <Text size="sm" fw={500}>提取的文档内容：</Text>
              <ScrollArea mah={300}>
                <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                  {extractedTextPreview}
                </Text>
              </ScrollArea>
            </Stack>
          </Alert>
        </Collapse>

        {/* 主要内容区域 */}
        <Paper withBorder p="lg" radius="md" style={{ 
          height: 'calc(100vh - 300px)',
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column'
        }}>
            <Stack gap="md" style={{ height: '100%' }}>
              <Text fw={600} size="lg">对话历史</Text>
              
              <ScrollArea 
                ref={scrollAreaRef} 
                style={{ flex: 1 }} 
                scrollbarSize={8}
                type="hover"
              >
                <Stack gap="md" pr="sm">
                  {messages.length === 0 && isInitialGeneration && (
                    <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                      <Stack gap="md" align="center">
                        <IconSparkles size={64} color="var(--mantine-color-blue-6)" />
                        <Title order={3}>准备开始 AI 分析文档</Title>
                        <Text ta="center" size="sm" c="dimmed" maw={400}>
                          AI 将分析您的文档并生成结构化的数学知识点，您可以在对话中要求修改和优化结果
                        </Text>
                        <Button
                          leftSection={<IconSparkles size={16} />}
                          onClick={startInitialGeneration}
                          loading={isStreaming}
                          size="lg"
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
                            <Card withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-yellow-0)' }}>
                              <Group gap="xs" mb="xs">
                                <IconBrain size={16} color="var(--mantine-color-yellow-7)" />
                                <Text size="sm" fw={500} c="yellow.7">
                                  AI 思考过程
                                </Text>
                                <ActionIcon
                                  variant="subtle"
                                  size="xs"
                                  onClick={() => setShowReasoning(!showReasoning)}
                                >
                                  {showReasoning ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                                </ActionIcon>
                              </Group>
                              <Collapse in={showReasoning}>
                                <Box p="xs">
                                  <Text size="xs" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
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
                                </Box>
                              </Collapse>
                            </Card>
                          )}

                          {/* 消息内容 */}
                          {message.content && (
                            <div>
                              {/* 尝试解析JSON内容 */}
                              {(() => {
                                try {
                                  // 尝试解析JSON格式的知识点
                                  const jsonMatch = message.content.match(/```json\n([\s\S]*?)\n```/);
                                  if (jsonMatch) {
                                    const jsonContent = JSON.parse(jsonMatch[1]);
                                    if (Array.isArray(jsonContent)) {
                                      return (
                                        <Stack gap="sm">
                                          <Text size="sm" c="dimmed">AI 生成的知识点：</Text>
                                          {jsonContent.map((kp, index) => (
                                            <Card key={index} withBorder p="sm" bg="var(--mantine-color-blue-0)">
                                              <Stack gap="xs">
                                                <Group gap="xs">
                                                  <Badge variant="light" size="sm">{kp.category || '通用'}</Badge>
                                                  <Text fw={600} size="sm">{kp.title}</Text>
                                                </Group>
                                                <Text size="xs" c="dimmed">{kp.description}</Text>
                                                {kp.examples && kp.examples.length > 0 && (
                                                  <div>
                                                    <Text size="xs" fw={500} mb="xs">例题：</Text>
                                                    {kp.examples.map((ex: any, exIndex: number) => (
                                                      <Card key={exIndex} withBorder p="xs" bg="white" mb="xs">
                                                        <Text size="xs" fw={500}>题目：{ex.question}</Text>
                                                        <Text size="xs" c="dimmed">解答：{ex.solution}</Text>
                                                        {ex.difficulty && (
                                                          <Badge size="xs" variant="outline" mt="xs">
                                                            {ex.difficulty}
                                                          </Badge>
                                                        )}
                                                      </Card>
                                                    ))}
                                                  </div>
                                                )}
                                                {kp.tags && kp.tags.length > 0 && (
                                                  <Group gap="xs">
                                                    {kp.tags.map((tag: any, tagIndex: number) => (
                                                      <Badge key={tagIndex} variant="outline" size="xs">
                                                        {tag}
                                                      </Badge>
                                                    ))}
                                                  </Group>
                                                )}
                                              </Stack>
                                            </Card>
                                          ))}
                                        </Stack>
                                      );
                                    }
                                  }
                                  
                                  // 如果不是知识点格式，显示原文本
                                  return (
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
                                  );
                                } catch (e) {
                                  // 解析失败，显示原文本
                                  return (
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
                                  );
                                }
                              })()}
                            </div>
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
                            <Alert icon={<IconCheck size={16} />} color="green">
                              <Text size="sm" fw={500} mb="xs">
                                生成了 {message.knowledgePoints.length} 个知识点
                              </Text>
                              <Group gap="xs" wrap="wrap">
                                {message.knowledgePoints.map((kp, index) => (
                                  <Badge key={index} variant="light" size="sm">
                                    {kp.title}
                                  </Badge>
                                ))}
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
                  placeholder="输入您的消息或修改要求..."
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
          extractedText={extractedTextPreview}
          knowledgePoints={currentKnowledgePoints}
          onSuccess={() => {
            setShowKnowledgePreview(false);
            router.push('/dashboard/knowledge-base');
          }}
        />
      )}
      </Container>
    </>
  );
}
