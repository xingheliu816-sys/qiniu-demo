'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { username, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (username) {
        router.replace('/novels');
      } else {
        router.replace('/login');
      }
    }
  }, [username, isLoading, router]);

  return (
    <div className="flex-1 flex items-center justify-center bg-surface">
      <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
    </div>
  );
}
