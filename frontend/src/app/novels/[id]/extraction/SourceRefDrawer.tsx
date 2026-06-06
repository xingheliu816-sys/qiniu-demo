'use client';

import { useEffect } from 'react';

interface SourceRefDrawerProps {
  open: boolean;
  loading: boolean;
  chapterTitle?: string;
  excerpt?: string;
  startOffset?: number;
  endOffset?: number;
  fullLength?: number;
  error?: string;
  onClose: () => void;
}

export default function SourceRefDrawer({
  open,
  loading,
  chapterTitle,
  excerpt,
  startOffset,
  endOffset,
  fullLength,
  error,
  onClose,
}: SourceRefDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="w-full max-w-xl bg-card h-full overflow-hidden flex flex-col shadow-2xl">
        <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-serif font-bold text-ink truncate">{chapterTitle || '原文依据'}</h3>
            {typeof startOffset === 'number' && typeof endOffset === 'number' && (
              <p className="text-xs text-ink-light mt-0.5">字符 {startOffset} – {endOffset}{typeof fullLength === 'number' ? ` / 共 ${fullLength}` : ''}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 w-8 h-8 rounded-lg border border-border hover:border-accent/40 hover:text-accent text-ink-light flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-ink-light animate-pulse">加载中…</p>
          ) : error ? (
            <p className="text-sm text-error">{error}</p>
          ) : excerpt ? (
            <pre className="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans bg-paper/40 border border-border rounded-lg p-4">{excerpt}</pre>
          ) : (
            <p className="text-sm text-ink-light italic">未提供原文依据。</p>
          )}
        </div>
      </aside>
    </div>
  );
}
