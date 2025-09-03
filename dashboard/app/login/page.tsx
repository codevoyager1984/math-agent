'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconLock, IconUser } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  Box,
  Button,
  Center,
  Container,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { adminLogin } from '@/api/auth';
import { PATH_DASHBOARD } from '@/routes';
import useAuthStore from '@/stores/auth';

function Page() {
  const { loggedIn, setLoggedIn, setAccessToken, setUser } = useAuthStore();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (loggedIn) {
      router.push(PATH_DASHBOARD.default);
    }
  }, [loggedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    setLoading(true);

    try {
      const response = await adminLogin(username, password);

      // 保存认证信息到本地存储
      setAccessToken(response.access_token);
      setUser(response.user as any); // 类型转换，因为管理员用户和普通用户结构不同
      setLoggedIn(true);

      toast.success('登录成功');
      router.push(PATH_DASHBOARD.default);
    } catch (error: any) {
      console.error('Login failed:', error);
      // 错误处理已在 request 函数中处理（显示 toast）
    } finally {
      setLoading(false);
    }
  };

  // Don't render form if already logged in
  if (loggedIn) {
    return null;
  }

  return (
    <>
      <title>管理员登录 | Math Agent</title>
      <meta name="description" content="Math Agent Admin Login" />

      <Container size="xl" fluid>
        <Center>
          <Paper
            shadow="xl"
            p="xl"
            radius="lg"
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Stack gap="lg">
              <Center>
                <Title
                  order={1}
                  size="h2"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    fontWeight: 700,
                  }}
                >
                  Math Agent 管理员登录
                </Title>
              </Center>

              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <TextInput
                    label="用户名"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    leftSection={<IconUser size={16} />}
                    size="md"
                    required
                    disabled={loading}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(248, 249, 250, 0.8)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        '&:focus': {
                          borderColor: '#667eea',
                          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.2)',
                        },
                      },
                    }}
                  />

                  <PasswordInput
                    label="密码"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftSection={<IconLock size={16} />}
                    size="md"
                    required
                    disabled={loading}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(248, 249, 250, 0.8)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        '&:focus': {
                          borderColor: '#667eea',
                          boxShadow: '0 0 0 2px rgba(102, 126, 234, 0.2)',
                        },
                      },
                    }}
                  />

                  <Button
                    type="submit"
                    size="md"
                    fullWidth
                    loading={loading}
                    mt="md"
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 5px 15px rgba(102, 126, 234, 0.3)',
                      },
                    }}
                  >
                    {loading ? '登录中...' : '登录'}
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Paper>
        </Center>
      </Container>
    </>
  );
}

export default Page;
