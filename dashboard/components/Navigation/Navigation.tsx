import { useMemo } from 'react';
import { IconHome, IconX, IconDatabase, IconBrain } from '@tabler/icons-react';
import { ActionIcon, Box, Flex, Group, ScrollArea, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { LinksGroup } from '@/components/Navigation/Links/Links';
import { PATH_DASHBOARD, PATH_KNOWLEDGE_BASE } from '@/routes';
import Logo from '../common/Logo';
import classes from './Navigation.module.css';

const MENU_DATA = [
  {
    title: '首页',
    key: 'home',
    links: [
      {
        label: '首页',
        icon: <IconHome size={18} />,
        link: PATH_DASHBOARD.default,
      },
    ],
  },
  {
    title: '知识库',
    key: 'knowledge_base',
    links: [
      {
        label: '知识库',
        icon: <IconBrain size={18} />,
        link: PATH_KNOWLEDGE_BASE.list,
      },
    ],
  },
];

type NavigationProps = {
  onClose: () => void;
};

const Navigation = ({ onClose }: NavigationProps) => {
  const tablet_match = useMediaQuery('(max-width: 768px)');
  
  // 使用固定的主题颜色
  const themeColors = {
    primary_color: '#8B5CF6',
    primary_color_light: '#A78BFA',
    primary_color_dark: '#6D28D9'
  };

  const links = useMemo(() => {
    return MENU_DATA.map((m) => {
      return (
        <Box pl={0} mb="md" key={m.title}>
          <Text tt="uppercase" size="xs" pl="md" fw={500} mb="sm" className={classes.linkHeader}>
            {m.title}
          </Text>
          {m.links.map((item) => (
            <LinksGroup
              key={item.label}
              icon={item.icon}
              link={item.link}
              label={item.label}
              closeSidebar={() => {
                setTimeout(() => {
                  onClose();
                }, 250);
              }}
            />
          ))}
        </Box>
      );
    });
  }, []);

  return (
    <nav 
      className={classes.navbar}
      style={{
        backgroundColor: themeColors.primary_color,
        borderRightColor: themeColors.primary_color_light,
        '--mantine-primary-color-filled': themeColors.primary_color,
        '--mantine-primary-color-filled-hover': themeColors.primary_color_light,
        '--mantine-primary-color-light-color': themeColors.primary_color_light
      } as React.CSSProperties}
    >
      <div 
        className={classes.header}
        style={{
          borderBottomColor: themeColors.primary_color_light
        }}
      >
        <Flex justify="space-between" align="center" gap="sm">
          <Group justify="space-between" style={{ flex: tablet_match ? 'auto' : 1 }}>
            <Logo className={classes.logo} />
          </Group>
          {tablet_match && (
            <ActionIcon onClick={onClose} variant="transparent">
              <IconX color="white" />
            </ActionIcon>
          )}
        </Flex>
      </div>

      <ScrollArea className={classes.links}>
        <div className={classes.linksInner}>{links}</div>
      </ScrollArea>
    </nav>
  );
};

export default Navigation;
