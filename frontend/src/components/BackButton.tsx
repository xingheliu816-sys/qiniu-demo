'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  /** 点击后跳转的路径。不传则调用 router.back() 返回浏览器上一页。 */
  href?: string;
  /** 按钮文案，默认"← 返回" */
  label?: string;
}

export default function BackButton({ href, label = '← 返回' }: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm px-3 py-1.5 rounded-lg border border-border text-ink-light hover:text-accent hover:border-accent/30 transition-colors cursor-pointer"
      title={href ? `返回 ${href}` : '返回上一级'}
    >
      {label}
    </button>
  );
}
