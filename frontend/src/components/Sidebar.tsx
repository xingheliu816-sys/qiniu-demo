'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const { username, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 从当前路径解析 novel_id，用于"查看提炼内容"入口
  const novelIdMatch = pathname.match(/^\/novels\/(\d+)/);
  const currentNovelId = novelIdMatch ? Number(novelIdMatch[1]) : null;

  function handleExtractionView() {
    if (currentNovelId) {
      router.push(`/novels/${currentNovelId}/extraction?saved=1`);
      setOpen(false);
    } else {
      setOpen(false);
      setTimeout(() => {
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-medium z-50 shadow-lg bg-error text-white';
        toast.textContent = '请先选择一本小说。';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
      }, 200);
    }
  }

  const navItems = [
    { label: '我的小说', path: '/novels', icon: '📖' },
    { label: '历史记录', path: '/history', icon: '📋' },
    { label: '查看提炼内容', action: 'extraction-view', icon: '📑' },
    { label: 'YAML 剧本', path: currentNovelId ? `/novels/${currentNovelId}/yaml` : `/novels/0/yaml`, icon: '🎬' },
    { label: 'YAML 编辑器', path: '/yaml-editor', icon: '✏️' },
    { label: 'YAML Schema 规则库', path: '/schemas', icon: '📐' },
  ];

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-3 top-3 z-50 w-8 h-8 bg-card border border-border rounded-lg flex items-center justify-center text-sm text-ink-light hover:text-ink transition-colors cursor-pointer"
      >
        {open ? '✕' : '☰'}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-ink/20" onClick={() => setOpen(false)} />
      )}

      <div
        ref={sidebarRef}
        className={`fixed left-0 top-0 h-full z-50 bg-card border-r border-border transition-all duration-200 flex flex-col ${
          open ? 'w-48' : 'w-0 overflow-hidden pointer-events-none'
        }`}
      >
        <div className="p-4 border-b border-border shrink-0">
          <span className="font-serif font-bold text-sm text-ink truncate block">Novel2Script AI</span>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.path && (pathname === item.path || pathname.startsWith(item.path + '/'));
            const isExtractionActive = item.action === 'extraction-view' && pathname.includes('/extraction');
            const active = isActive || isExtractionActive;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.action === 'extraction-view') {
                    handleExtractionView();
                  } else if (item.path) {
                    router.push(item.path);
                    setOpen(false);
                  }
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                  active
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-ink-light hover:text-ink hover:bg-surface'
                }`}
              >
                <span>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2 shrink-0">
          <div className="text-xs text-ink-light truncate px-2">{username}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-ink-light hover:text-error hover:bg-error/5 transition-colors cursor-pointer"
          >
            退出登录
          </button>
        </div>
      </div>
    </>
  );
}
