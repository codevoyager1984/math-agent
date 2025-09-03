'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Box, Flex, Group, Paper, PaperProps, Text } from '@mantine/core';
import { Surface } from '@/components/common/Surface';
import classes from './Stats.module.css';

type StatsCardProps = {
  data: { title: string; value: string };
  extra_elements?: React.ReactNode[];
} & PaperProps;

const StatsCard = ({ data, extra_elements, ...others }: StatsCardProps) => {
  const { title, value } = data;
  const router = useRouter();

  return (
    <Surface 
      component={Paper} 
      p="lg" 
      radius="md" 
      withBorder 
      className={classes.card}
      {...others}
    >
      <Group justify="space-between" mb="sm">
        <Text size="xs" c="dimmed" className={classes.title} lineClamp={1} title={title}>
          {title}
        </Text>
      </Group>

      <Flex justify={'space-between'} align={'center'} gap="md" mt="xl">
        <Box style={{ overflow: 'hidden', maxWidth: extra_elements ? '70%' : '100%' }}>
          <Text className={classes.value} lineClamp={1} title={value}>
            {value}
          </Text>
        </Box>

        {extra_elements && (
          <Box style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            opacity: 0.8
          }}>
            {extra_elements}
          </Box>
        )}
      </Flex>
    </Surface>
  );
};

export default StatsCard;
