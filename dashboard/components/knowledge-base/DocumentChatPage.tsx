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

// 工具函数：从带行号的文本中按行号提取内容
function extractContentByLines(numberedText: string, startLine: number, endLine: number): string {
  const lines = numberedText.split('\n');
  
  console.log(`Extracting lines ${startLine}-${endLine} from ${lines.length} total lines`);
  
  // 找到匹配的行号并提取内容
  const extractedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配行号格式 "001: 内容" 或 "  1: 内容"
    const match = line.match(/^\s*(\d+):\s*(.*)$/);
    if (match) {
      const lineNumber = parseInt(match[1]);
      const content = match[2];
      
      if (lineNumber >= startLine && lineNumber <= endLine) {
        extractedLines.push(content);
      }
    }
  }
  
  const result = extractedLines.join('\n').trim();
  console.log(`Extracted content (${result.length} chars):`, result.substring(0, 200) + '...');
  
  return result;
}

// 工具函数：将原始文本转换为带行号格式
function addLineNumbers(text: string): string {
  const lines = text.split('\n');
  return lines.map((line, index) => `${(index + 1).toString().padStart(3, ' ')}: ${line}`).join('\n');
}

// 工具函数：从位置信息解析知识点
function parseKnowledgePointsFromPositions(originalText: string, positionData: any[]): DocumentInput[] {
  const knowledgePoints: DocumentInput[] = [];
  console.log('Starting to parse', positionData.length, 'knowledge points');
  
  // 将原始文本转换为带行号格式，匹配AI处理的格式
  const numberedText = addLineNumbers(originalText);
  console.log('Created numbered text, total lines:', numberedText.split('\n').length);
  
  for (let i = 0; i < positionData.length; i++) {
    const kpData = positionData[i];
    console.log(`Processing knowledge point ${i + 1}:`, kpData);
    
    // 提取描述内容
    const descRange = kpData.description_range || {};
    console.log(`Description range for KP ${i + 1}:`, descRange);
    
    let description = '';
    if (descRange.start_line && descRange.end_line) {
      description = extractContentByLines(
        numberedText,
        descRange.start_line,
        descRange.end_line
      );
    } else {
      // 如果没有范围信息，使用已有的描述或标题
      description = kpData.description || kpData.title || '未命名知识点';
    }
    console.log(`Extracted description for KP ${i + 1}:`, description.substring(0, 100) + '...');
    
    // 提取例题
    const examples = [];
    const examplesData = kpData.examples || [];
    console.log(`Processing ${examplesData.length} examples for KP ${i + 1}`);
    
    for (let j = 0; j < examplesData.length; j++) {
      const exData = examplesData[j];
      console.log(`Processing example ${j + 1}:`, exData);
      
      const questionRange = exData.question_range || {};
      const solutionRange = exData.solution_range || {};
      
      console.log(`Question range:`, questionRange);
      console.log(`Solution range:`, solutionRange);
      
      let question = '';
      let solution = '';
      
      // 提取题目
      if (questionRange.start_line && questionRange.end_line) {
        question = extractContentByLines(
          numberedText,
          questionRange.start_line,
          questionRange.end_line
        );
      } else if (exData.question) {
        question = exData.question;
      }
      
      // 提取解答
      if (solutionRange.start_line && solutionRange.end_line) {
        solution = extractContentByLines(
          numberedText,
          solutionRange.start_line,
          solutionRange.end_line
        );
      } else if (exData.solution) {
        solution = exData.solution;
      }
      
      console.log(`Extracted question:`, question);
      console.log(`Extracted solution:`, solution);
      
      if (question.trim() && solution.trim()) {
        examples.push({
          question: question.trim(),
          solution: solution.trim(),
          difficulty: exData.difficulty || 'medium'
        });
        console.log(`Added example ${j + 1} successfully`);
      } else {
        console.warn(`Failed to extract example ${j + 1}: question="${question}", solution="${solution}"`);
        console.warn(`Question range:`, questionRange, `Solution range:`, solutionRange);
      }
    }
    
    console.log(`Total examples extracted for KP ${i + 1}:`, examples.length);
    
    // 创建知识点
    const kp: DocumentInput = {
      title: kpData.title || '未命名知识点',
      description: description || kpData.description || '',
      category: kpData.category || 'general',
      examples,
      tags: kpData.tags || []
    };
    
    knowledgePoints.push(kp);
  }
  
  console.log('Finished parsing, total knowledge points:', knowledgePoints.length);
  return knowledgePoints;
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

  // 获取会话的完整提取文本
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        console.log('Fetching session data for:', sessionId);
        const response = await fetch(`/api/knowledge-base/chat-session/${sessionId}`);
        if (response.ok) {
          const sessionData = await response.json();
          console.log('Session data received:', sessionData);
          if (sessionData.extracted_text) {
            setFullExtractedText(sessionData.extracted_text);
            console.log('Loaded full extracted text:', sessionData.extracted_text.length, 'characters');
            console.log('First 500 chars:', sessionData.extracted_text.substring(0, 500));
          } else {
            console.warn('No extracted_text in session data, using preview');
          }
        } else {
          console.error('Failed to fetch session data:', response.status);
        }
      } catch (error) {
        console.warn('Failed to fetch session data:', error);
      }
    };
    
    fetchSessionData();
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
            
            // 检测是否开始生成JSON（只在第一次检测到时触发）
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
                let positionData = null;
                
                // 处理不同的JSON格式
                let rawData = null;
                if (Array.isArray(jsonContent)) {
                  rawData = jsonContent;
                } else if (jsonContent.knowledge_points && Array.isArray(jsonContent.knowledge_points)) {
                  rawData = jsonContent.knowledge_points;
                }
                
                if (rawData && rawData.length > 0) {
                  console.log('Extracted raw data:', JSON.stringify(rawData, null, 2));
                  
                  // 检查数据格式：是位置信息还是直接内容
                  const firstItem = rawData[0];
                  const isPositionFormat = firstItem.description_range || firstItem.examples?.some((ex: any) => ex.question_range || ex.solution_range);
                  
                  console.log('Is position format:', isPositionFormat);
                  
                  let knowledgePointsArray: DocumentInput[] = [];
                  
                  if (isPositionFormat) {
                    // 位置信息格式，需要解析行号
                    console.log('Using position-based parsing');
                    console.log('Full extracted text length:', fullExtractedText.length);
                    console.log('Preview text length:', extractedTextPreview.length);
                    console.log('Are they the same?', fullExtractedText === extractedTextPreview);
                    
                    // 显示文本的前几行和后几行
                    const lines = fullExtractedText.split('\n');
                    console.log('Total lines in full text:', lines.length);
                    console.log('First 5 lines:', lines.slice(0, 5));
                    console.log('Lines 110-115:', lines.slice(109, 115));
                    console.log('Lines 220-230:', lines.slice(219, 230));
                    
                    knowledgePointsArray = parseKnowledgePointsFromPositions(fullExtractedText, rawData);
                  } else {
                    // 直接内容格式，直接使用
                    console.log('Using direct content format');
                    knowledgePointsArray = rawData.map((kp: any) => ({
                      title: kp.title || '未命名知识点',
                      description: kp.description || '',
                      category: kp.category || 'general',
                      examples: (kp.examples || []).map((ex: any) => ({
                        question: ex.question || '',
                        solution: ex.solution || '',
                        difficulty: ex.difficulty || 'medium'
                      })),
                      tags: kp.tags || []
                    }));
                  }
                  
                  console.log('Final parsed knowledge points:', JSON.stringify(knowledgePointsArray, null, 2));
                  
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
                    
                    setCurrentKnowledgePoints(knowledgePointsArray);
                    lastMessage.knowledgePoints = knowledgePointsArray;
                    setShowKnowledgePreview(true);
                    toast.success(`AI 生成了 ${knowledgePointsArray.length} 个知识点`);
                  } else {
                    console.warn('No knowledge points were successfully parsed');
                    toast.warning('知识点解析失败，请检查AI输出格式');
                  }
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

              {/* 当前知识点状态 */}
              {currentKnowledgePoints.length > 0 && (
                <Alert 
                  icon={<IconSparkles size={16} />} 
                  color="blue"
                  style={{ 
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid var(--mantine-color-blue-3)'
                  }}
                  onClick={() => setShowKnowledgePreview(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-1)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Text size="sm" fw={500}>
                        已生成 {currentKnowledgePoints.length} 个知识点
                      </Text>
                      <Badge variant="light" color="green" size="sm">
                        点击编辑和导入
                      </Badge>
                    </Group>
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="blue"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowKnowledgePreview(true);
                      }}
                    >
                      查看详情
                    </Button>
                  </Group>
                </Alert>
              )}

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
          extractedText={fullExtractedText}
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
