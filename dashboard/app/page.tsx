'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PATH_DASHBOARD, PATH_LOGIN } from '@/routes';
import useAuthStore from '@/stores/auth';

export default function HomePage() {
  const { loggedIn } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (loggedIn) {
      router.push(PATH_DASHBOARD.default);
    } else {
      router.push(PATH_LOGIN.default);
    }
  }, [loggedIn, router]);

  return <></>;
}
