'use client';

import { useRouter } from 'next/navigation';
import { ApiError, toApiError } from '@/lib/api';

interface PageErrorProps {
  error: unknown;
  onRetry?: () => void;
  /** 在 UNAUTHENTICATED 时是否展示 "去登录" 入口，默认 true */
  showLoginAction?: boolean;
}

function actionLabelFor(code: string): string {
  if (code === 'UNAUTHENTICATED') return '去登录';
  return '重试';
}

/**
 * 错误页通用展示：根据 ApiError.code 给出不同提示与操作。
 *
 * 不会显示后端原始错误（500 traceback 等），避免泄露内部信息。
 * 401 默认给"去登录"按钮，其它情况给"重试"。
 */
export default function PageError({ error, onRetry, showLoginAction = true }: PageErrorProps) {
  const router = useRouter();
  const e: ApiError = toApiError(error);
  const isAuth = e.code === 'UNAUTHENTICATED';
  const retryLabel = actionLabelFor(e.code);

  const handlePrimary = () => {
    if (isAuth && showLoginAction) {
      router.replace('/login');
      return;
    }
    onRetry?.();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-4">
        <p className="text-sm text-ink whitespace-pre-wrap">{e.message}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {(onRetry || (isAuth && showLoginAction)) && (
            <button
              onClick={handlePrimary}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              {retryLabel}
            </button>
          )}
          <button
            onClick={() => router.push('/novels')}
            className="px-4 py-2 border border-border text-ink-light hover:text-ink text-sm font-medium rounded-lg transition-colors"
          >
            返回我的小说列表
          </button>
        </div>
      </div>
    </div>
  );
}
