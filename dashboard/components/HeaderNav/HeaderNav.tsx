'use client';

import {
  IconBrush,
  IconCircleHalf2,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMoonStars,
  IconPalette,
  IconSunHigh,
} from '@tabler/icons-react';
import { ActionIcon, Burger, Group, Menu, Tooltip, useMantineColorScheme } from '@mantine/core';
import UserDropDown from '@/components/UserDropDown/UserDropDown';
import { themeStyles, useThemeStyle } from '@/theme';

const ICON_SIZE = 20;

type HeaderNavProps = {
  mobileOpened?: boolean;
  toggleMobile?: () => void;
  desktopOpened?: boolean;
  toggleDesktop?: () => void;
};

const HeaderNav = (props: HeaderNavProps) => {
  const { desktopOpened, toggleDesktop, toggleMobile, mobileOpened } = props;
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const { style: themeStyle, setStyle } = useThemeStyle();

  // 修改setThemeStyle方法，让它直接切换主题，不需要刷新页面
  const handleThemeStyleChange = (newStyle: typeof themeStyle) => {
    // 只有当新风格与当前风格不同时才变更
    if (newStyle !== themeStyle) {
      setStyle(newStyle);
      // 现在不需要刷新页面，因为ThemeProvider会监听themeStyle的变化并更新主题
    }
  };

  return (
    <Group justify="space-between">
      <Group gap={0}>
        <Tooltip label="Toggle side navigation">
          <ActionIcon visibleFrom="md" onClick={toggleDesktop}>
            {desktopOpened ? <IconLayoutSidebarLeftCollapse /> : <IconLayoutSidebarLeftExpand />}
          </ActionIcon>
        </Tooltip>
        <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="md" size="sm" />
      </Group>
      <Group>
        {/* 明暗模式切换菜单 */}
        <Menu shadow="lg" width={200}>
          <Menu.Target>
            <Tooltip label="切换明暗模式">
              <ActionIcon variant="light">
                {colorScheme === 'auto' ? (
                  <IconCircleHalf2 size={ICON_SIZE} />
                ) : colorScheme === 'dark' ? (
                  <IconMoonStars size={ICON_SIZE} />
                ) : (
                  <IconSunHigh size={ICON_SIZE} />
                )}
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown
            style={{
              width: '120px',
            }}
          >
            <Menu.Label tt="uppercase" ta="center" fw={200}>
              明暗模式
            </Menu.Label>
            <Menu.Item
              leftSection={<IconSunHigh size={16} />}
              onClick={() => setColorScheme('light')}
            >
              白天模式
            </Menu.Item>
            <Menu.Item
              leftSection={<IconMoonStars size={16} />}
              onClick={() => setColorScheme('dark')}
            >
              夜间模式
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <UserDropDown showDahboard={false} />
      </Group>
    </Group>
  );
};

export default HeaderNav;
