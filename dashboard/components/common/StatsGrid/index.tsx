import React, { ReactNode } from 'react';
import { Grid, MantineSpacing, PaperProps, Skeleton, StyleProp } from '@mantine/core';
import ErrorAlert from '@/components/common/ErrorAlert';
import StatsCard from '@/components/common/StatsCard';
import classes from './StatsGrid.module.css';

export interface StatsGridItem {
  title: string;
  value: string;
  extra_elements?: React.ReactNode[];
}

type StatsGridProps = {
  data?: StatsGridItem[];
  paperProps?: PaperProps;
  error?: ReactNode;
  loading?: boolean;
  cols?: StyleProp<number>;
  /** Spacing between columns, `'md'` by default */
  spacing?: StyleProp<MantineSpacing>;
};

export function StatsGrid({
  data,
  loading,
  error,
  paperProps,
  cols,
  spacing = { base: 10, sm: 'xl' },
}: StatsGridProps) {
  console.log(data);

  // 由于 SimpleGrid 可能不能正确处理大量的项目，改用 Grid 组件
  // 确保每行最多显示 6 个项目
  const renderStats = () => {
    if (!data || data.length === 0) return null;

    return data.map((stat) => (
      <Grid.Col key={stat.title} span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
        <StatsCard data={stat} extra_elements={stat.extra_elements} {...paperProps} />
      </Grid.Col>
    ));
  };

  const renderSkeletons = () => {
    if (!data) return Array(4).fill(0);
    return Array.from({ length: data.length }).map((_, i) => (
      <Grid.Col key={`stats-loading-${i}`} span={{ base: 12, sm: 6, md: 4, lg: 2 }}>
        <Skeleton visible={true} height={200} />
      </Grid.Col>
    ));
  };

  return (
    <div className={classes.root}>
      {error ? (
        <ErrorAlert title="Error loading stats" message={error.toString()} />
      ) : (
        <Grid gutter={spacing}>{loading ? renderSkeletons() : renderStats()}</Grid>
      )}
    </div>
  );
}
