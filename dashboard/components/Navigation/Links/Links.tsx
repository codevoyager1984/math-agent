import { Box, Group, UnstyledButton } from "@mantine/core";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import classes from "./Links.module.css";

interface LinksGroupProps {
  icon?: React.ReactNode;
  label: string;
  initiallyOpened?: boolean;
  link?: string;
  closeSidebar: () => void;
}

export function LinksGroup(props: LinksGroupProps) {
  const { icon: Icon, label, initiallyOpened, link, closeSidebar } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [opened, setOpened] = useState(initiallyOpened || false);
  
  // 使用固定的主题颜色
  const themeColors = {
    primary_color: '#8B5CF6'
  };

  useEffect(() => {
    setOpened(pathname === link);
  }, [pathname, link]);

  return (
    <>
      <UnstyledButton
        onClick={() => {
          setOpened((o) => !o);
          link && router.push(link || "#");
          closeSidebar();
        }}
        className={classes.control}
        data-active={opened || undefined}
        style={{
          color: 'white',
          backgroundColor: opened ? 'white' : 'transparent',
          ...(opened && {
            color: themeColors.primary_color
          })
        }}
      >
        <Group justify="space-between" gap={0}>
          <Box style={{ display: "flex", alignItems: "center" }}>
            {Icon}
            <Box ml="md">{label}</Box>
          </Box>
        </Group>
      </UnstyledButton>
    </>
  );
}
