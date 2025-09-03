import React from 'react';
import { DatePickerInput } from '@mantine/dates';
import { Group, Button, Text } from '@mantine/core';
import dayjs from 'dayjs';

interface DateRangeFilterProps {
  dateRange: [Date | null, Date | null];
  onDateRangeChange: (dateRange: [Date | null, Date | null]) => void;
  presets?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  label?: string;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateRange,
  onDateRangeChange,
  presets = true,
  size = 'sm',
  label = '时间范围'
}) => {
  const handlePresetClick = (days: number) => {
    const endDate = dayjs().toDate();
    const startDate = dayjs().subtract(days, 'days').toDate();
    onDateRangeChange([startDate, endDate]);
  };

  const presetButtons = [
    { label: '最近7天', days: 7 },
    { label: '最近30天', days: 30 },
    { label: '最近90天', days: 90 },
    { label: '最近一年', days: 365 }
  ];

  return (
    <>
      <DatePickerInput
        type="range"
        value={dateRange}
        onChange={onDateRangeChange}
        placeholder="选择时间范围"
        clearable={false}
        maxDate={new Date()}
        size={size}
        label={label}
      />
      
      {presets && (
        <Group gap="xs" mt="xs">
          <Text size="xs" c="dimmed">快速选择:</Text>
          {presetButtons.map((preset) => (
            <Button
              key={preset.days}
              variant="light"
              size="xs"
              onClick={() => handlePresetClick(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </Group>
      )}
    </>
  );
};

export default DateRangeFilter;
