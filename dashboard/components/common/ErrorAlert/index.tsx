import { ReactNode } from 'react';
import { IconBug } from '@tabler/icons-react';
import { Alert, AlertProps } from '@mantine/core';

type Props = { message: ReactNode } & AlertProps;

const ErrorAlert = ({ message, ...others }: Props) => {
  const icon = <IconBug size={18} />;
  const { title } = others;

  return (
    <Alert variant="light" color="red" title={title} icon={icon} {...others}>
      {message || ''}
    </Alert>
  );
};

export default ErrorAlert;
