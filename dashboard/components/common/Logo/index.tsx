import Link from 'next/link';
import { Group, Text, UnstyledButton, UnstyledButtonProps } from '@mantine/core';
import classes from './Logo.module.css';

type LogoProps = {
  href?: string;
} & UnstyledButtonProps;

const Logo = ({ href, ...others }: LogoProps) => {
  return (
    <UnstyledButton className={classes.logo} component={Link} href={href || '/'} {...others}>
      <Group
        gap="xs"
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div>
          <Text fw={700} size={'xl'}>
            Math Agent
          </Text>
        </div>
      </Group>
    </UnstyledButton>
  );
};

export default Logo;
