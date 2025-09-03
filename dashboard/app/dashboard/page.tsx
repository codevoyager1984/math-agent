'use client';

import { Container, Stack } from '@mantine/core';
import PageHeader from '@/components/PageHeader/PageHeader';

function Page() {
  return (
    <>
      <>
        <title>系统仪表盘 | Math Agent</title>
        <meta name="description" content="Math Agent" />
      </>
      <Container fluid>
        <Stack gap="lg">
          <PageHeader title="系统仪表盘 | Math Agent" />
        </Stack>
      </Container>
    </>
  );
}

export default Page;
