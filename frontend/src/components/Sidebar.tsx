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

  const navItems = [
    { label: '我的小说', path: '/novels', icon: '📖' },
    { label: '历史记录', path: '/history', icon: '📋' },
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
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { router.push(item.path); setOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                pathname === item.path || pathname.startsWith(item.path + '/')
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-ink-light hover:text-ink hover:bg-surface'
              }`}
            >
              <span>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
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
