'use client';

import { useRouter } from 'next/navigation';

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function PageError({
  title = '页面加载失败',
  message = '请稍后重试',
  onRetry,
}: PageErrorProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <span className="text-3xl text-error font-bold">!</span>
      </div>
      <h2 className="text-lg font-semibold text-ink mb-2">{title}</h2>
      <p className="text-sm text-ink-light text-center mb-6 max-w-md">{message}</p>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            重试
          </button>
        )}
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border border-border text-ink-light hover:text-ink text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          返回
        </button>
      </div>
    </div>
  );
}
