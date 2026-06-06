'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';

const parseStatusLabel: Record<string, { label: string; cls: string }> = {
  not_parsed: { label: '未识别', cls: 'bg-ink-light/10 text-ink-light' },
  parsed: { label: '已识别', cls: 'bg-success/10 text-success' },
  parse_failed: { label: '识别失败', cls: 'bg-error/10 text-error' },
};

function showToast(message: string, type: 'success' | 'error') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-medium z-50 shadow-lg ${
    type === 'success' ? 'bg-success text-white' : 'bg-error text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export default function NovelChaptersPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const novelId = Number(params.id);

  const [novelTitle, setNovelTitle] = useState('');
  const [chapters, setChapters] = useState<api.ChapterItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchParsing, setBatchParsing] = useState(false);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  const loadChapters = useCallback(async () => {
    if (!username || !novelId) return;
    setPageLoading(true);
    try {
      const detail = await api.getNovel(novelId);
      if (!detail.success || !detail.novel) {
        showToast('小说项目不存在或无权访问', 'error');
        return;
      }
      setNovelTitle(detail.novel.title);
      const chList = await api.getChapters(novelId);
      setChapters(chList.chapters || []);
    } catch {
      showToast('加载失败', 'error');
    } finally {
      setPageLoading(false);
    }
  }, [username, novelId]);

  useEffect(() => {
    const timer = window.setTimeout(loadChapters, 0);
    return () => window.clearTimeout(timer);
  }, [loadChapters]);

  async function handleAddChapter() {
    try {
      const res = await api.createChapter(novelId);
      if (res.success && res.chapter) {
        setChapters(prev => [...prev, res.chapter!]);
        router.push(`/novels/${novelId}/chapter/${res.chapter.id}`);
      } else {
        showToast(res.message || '创建章节失败', 'error');
      }
    } catch {
      showToast('创建章节失败', 'error');
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === chapters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(chapters.map(c => c.id)));
    }
  }

  async function handleBatchParse() {
    if (selectedIds.size === 0) {
      showToast('请先勾选要识别的章节', 'error');
      return;
    }
    setBatchParsing(true);
    try {
      const res = await api.batchParseChapters(novelId, Array.from(selectedIds));
      if (res.success) {
        showToast(res.message, 'success');
        const chList = await api.getChapters(novelId);
        setChapters(chList.chapters || []);
        setSelectedIds(new Set());
        setBatchMode(false);
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('批量识别失败', 'error');
    } finally {
      setBatchParsing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
      </div>
    );
  }

  if (!username) return null;

  const allParsedCount = chapters.filter(c => c.parse_status === 'parsed').length;

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-serif font-bold text-ink">{novelTitle || '未命名'}</h2>
            <p className="text-sm text-ink-light mt-1">
              {chapters.length} 个章节 · 已识别 {allParsedCount} 个
            </p>
          </div>
          <div className="flex items-center gap-3">
            {chapters.length > 0 && (
              <button
                onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  batchMode ? 'bg-accent text-white border-accent' : 'border-border text-ink-light hover:border-accent/30'
                }`}
              >
                {batchMode ? '取消批量' : '批量识别'}
              </button>
            )}
          </div>
        </div>

        {pageLoading ? (
          <div className="animate-pulse text-ink-light font-serif text-lg text-center py-20">加载中...</div>
        ) : chapters.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-ink-light text-sm mb-4">还没有章节，点击下方按钮新增。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {batchMode && (
              <div className="flex items-center gap-3 px-1 py-2">
                <label className="flex items-center gap-2 text-sm text-ink-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === chapters.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-accent"
                  />
                  全选
                </label>
                <button
                  onClick={handleBatchParse}
                  disabled={batchParsing || selectedIds.size === 0}
                  className="px-3 py-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {batchParsing ? '识别中...' : `识别所选章节 (${selectedIds.size})`}
                </button>
              </div>
            )}

            {chapters.map((ch) => {
              const st = parseStatusLabel[ch.parse_status] || parseStatusLabel.not_parsed;
              return (
                <div
                  key={ch.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {batchMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ch.id)}
                        onChange={() => toggleSelect(ch.id)}
                        className="w-4 h-4 accent-accent shrink-0"
                      />
                    )}
                    <span className="text-sm text-ink-light shrink-0 w-8">{ch.chapter_index}.</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-ink">{ch.title}</span>
                      <span className="ml-3 text-xs text-ink-light">{ch.word_count} 字</span>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => router.push(`/novels/${novelId}/chapter/${ch.id}`)}
                      className="text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.parseChapter(ch.id);
                          if (res.success) {
                            showToast(res.message, 'success');
                            const chList = await api.getChapters(novelId);
                            setChapters(chList.chapters || []);
                          } else {
                            showToast(res.message, 'error');
                            const chList = await api.getChapters(novelId);
                            setChapters(chList.chapters || []);
                          }
                        } catch {
                          showToast('识别失败', 'error');
                        }
                      }}
                      className="text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      识别
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleAddChapter}
          className="fixed bottom-8 right-8 w-14 h-14 bg-accent hover:bg-accent-hover text-white rounded-full shadow-lg flex items-center justify-center text-2xl font-light transition-colors"
          title="新增章节"
        >
          +
        </button>
      </main>
    </div>
  );
}
