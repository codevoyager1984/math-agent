'use client';

import React from 'react';
import {
  Breadcrumbs,
  BreadcrumbsProps,
  Divider,
  Paper,
  PaperProps,
  rem,
  Stack,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import { Surface } from '../Surface';

type PageHeaderProps = {
  title: string;
  breadcrumbItems?: any;
  rightSection?: React.ReactNode;
} & PaperProps;

export const PageHeader = (props: PageHeaderProps) => {
  const { breadcrumbItems, title, rightSection, ...others } = props;
  const theme = useMantineTheme();
  const colorScheme = useColorScheme();

  const BREADCRUMBS_PROPS: Omit<BreadcrumbsProps, 'children'> = {
    style: {
      a: {
        padding: rem(8),
        borderRadius: theme.radius.sm,
        fontWeight: 500,
        color: colorScheme === 'dark' ? theme.white : theme.black,

        '&:hover': {
          transition: 'all ease 150ms',
          backgroundColor: colorScheme === 'dark' ? theme.colors.dark[5] : theme.colors.gray[2],
          textDecoration: 'none',
        },
      },
    },
  };

  return (
    <>
      <Surface
        component={Paper}
        style={{ backgroundColor: 'transparent', width: '100%' }}
        {...others}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Stack gap="sm">
            <Title order={3}>{title}</Title>
            <Breadcrumbs {...BREADCRUMBS_PROPS}>{breadcrumbItems}</Breadcrumbs>
          </Stack>
          <div>{rightSection}</div>
        </div>
      </Surface>
      <Divider />
    </>
  );
};
