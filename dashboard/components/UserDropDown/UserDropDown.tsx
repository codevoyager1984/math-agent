import { useRouter } from 'next/navigation';
import {
  IconDashboard,
  IconLogout,
  IconMoneybag,
  IconPackage,
  IconSettings,
} from '@tabler/icons-react';
import { Avatar, Menu, rem, Text, useMantineTheme } from '@mantine/core';
import { modals } from '@mantine/modals';
import { PATH_DASHBOARD } from '@/routes';
import useAuthStore from '@/stores/auth';

interface Props {
  showDahboard?: boolean;
}

function UserDropDown(props: Props) {
  const { showDahboard = true } = props;
  const theme = useMantineTheme();

  const router = useRouter();
  const { user, setLoggedIn, setUser, setAccessToken } = useAuthStore();
  const handleLogout = () => {
    setLoggedIn(false);
    setUser(null);
    setAccessToken(null);
    router.push('/');
  };

  const openLogoutModal = () =>
    modals.openConfirmModal({
      title: '退出登录',
      centered: true,
      children: <Text size="sm">你确认需要退出登录吗？</Text>,
      labels: { confirm: '确认', cancel: '取消' },
      confirmProps: { color: 'red' },
      onCancel: () => {},
      onConfirm: async () => {
        handleLogout();
      },
    });

  return (
    <Menu
      transitionProps={{ transition: 'pop-top-right' }}
      position="top-end"
      width={130}
      withinPortal
    >
      <Menu.Target>
        <Avatar
          src={''}
          style={{
            cursor: 'pointer',
            width: rem(40),
            height: rem(40),
          }}
        />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          onClick={openLogoutModal}
          leftSection={
            <IconLogout
              style={{ width: rem(16), height: rem(16) }}
              color={theme.colors.red[6]}
              stroke={1.5}
            />
          }
        >
          退出登录
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export default UserDropDown;
