import { Badge } from '@mantine/core';

export const StatusBadge = ({ status, color }: { status: string; color: string }) => {
  return (
    <Badge color={color} variant="filled" radius="sm">
      {status}
    </Badge>
  );
};
