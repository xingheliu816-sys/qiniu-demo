'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import PageError from '@/components/PageError';

const extractStatusLabel: Record<string, { label: string; cls: string }> = {
  not_parsed: { label: '未提炼', cls: 'bg-ink-light/10 text-ink-light' },
  parsed: { label: '已提炼', cls: 'bg-success/10 text-success' },
  parse_failed: { label: '提炼失败', cls: 'bg-error/10 text-error' },
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
  const [pageError, setPageError] = useState<unknown>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'batch'; ids: number[] } | null>(null);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  const loadChapters = useCallback(async () => {
    if (!username || !novelId) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const detail = await api.getNovel(novelId);
      if (!detail.success || !detail.novel) {
        setPageError({ code: 'NOT_FOUND', message: '小说项目不存在或无权访问' });
        return;
      }
      setNovelTitle(detail.novel.title);
      const chList = await api.getChapters(novelId);
      setChapters(chList.chapters || []);
    } catch (err) {
      setPageError(err);
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

  async function handleViewNovelExtraction() {
    try {
      const ext = await api.getExtraction(novelId);
      if (ext.success) {
        router.push(`/novels/${novelId}/extraction`);
      } else {
        showToast(ext.message || '该小说尚未进行整体提炼', 'error');
      }
    } catch {
      showToast('获取提炼数据失败', 'error');
    }
  }

  // 单章「提炼」：合并 识别前置 + 进入小说提炼
  async function handleSingleExtract(chapterId: number) {
    setProcessing(true);
    try {
      const res = await api.extractFromChapter(chapterId);
      if (!res.success) {
        const fallback = res.stage === 'parse'
          ? '章节内容处理失败，请检查章节正文后重试。'
          : 'AI 提炼失败，请稍后重试。';
        showToast(res.message || fallback, 'error');
      }
      router.push(`/novels/${novelId}/extraction`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '提炼失败', 'error');
      router.push(`/novels/${novelId}/extraction`);
    } finally {
      setProcessing(false);
    }
  }

  // 多选「AI 提炼」：合并 识别前置 + 进入小说提炼
  async function handleBatchExtract() {
    if (selectedIds.size === 0) {
      showToast('请先选择需要提炼的章节。', 'error');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.extractFromChapters(novelId, Array.from(selectedIds));
      setMultiMode(false);
      setSelectedIds(new Set());
      if (!res.success) {
        const fallback = res.stage === 'parse'
          ? '章节内容处理失败，请检查章节正文后重试。'
          : 'AI 提炼失败，请稍后重试。';
        showToast(res.message || fallback, 'error');
      }
      router.push(`/novels/${novelId}/extraction`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '提炼失败', 'error');
      router.push(`/novels/${novelId}/extraction`);
    } finally {
      setProcessing(false);
    }
  }

  // 顶部「AI 提炼」按钮：多选模式走批量，非多选走「全部章节提炼」
  async function handleAIBtnClick() {
    if (multiMode) {
      handleBatchExtract();
      return;
    }
    if (chapters.length === 0) {
      showToast('请先添加章节。', 'error');
      return;
    }
    setProcessing(true);
    try {
      const ids = chapters.map(c => c.id);
      const res = await api.extractFromChapters(novelId, ids);
      if (!res.success) {
        const fallback = res.stage === 'parse'
          ? '章节内容处理失败，请检查章节正文后重试。'
          : 'AI 提炼失败，请稍后重试。';
        showToast(res.message || fallback, 'error');
      }
      router.push(`/novels/${novelId}/extraction`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '提炼失败', 'error');
      router.push(`/novels/${novelId}/extraction`);
    } finally {
      setProcessing(false);
    }
  }

  // Delete handlers
  function confirmSingleDelete(chapterId: number) {
    setDeleteTarget({ type: 'single', ids: [chapterId] });
  }

  function confirmBatchDelete() {
    if (selectedIds.size === 0) {
      showToast('请先选择需要删除的章节。', 'error');
      return;
    }
    setDeleteTarget({ type: 'batch', ids: Array.from(selectedIds) });
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    const { type, ids } = deleteTarget;
    setDeleteTarget(null);
    setProcessing(true);
    try {
      if (type === 'single') {
        const res = await api.deleteChapter(ids[0]);
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
      } else {
        const res = await api.batchDeleteChapters(novelId, ids);
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
      }
      setSelectedIds(new Set());
      const chList = await api.getChapters(novelId);
      setChapters(chList.chapters || []);
    } catch {
      showToast('删除失败', 'error');
    } finally {
      setProcessing(false);
    }
  }

  function toggleMultiMode() {
    setMultiMode(!multiMode);
    setSelectedIds(new Set());
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
      </div>
    );
  }

  if (pageError) {
    return <PageError error={pageError} onRetry={loadChapters} />;
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
              {chapters.length} 个章节 · 已提炼 {allParsedCount} 个
            </p>
          </div>
          <div className="flex items-center gap-3">
            {multiMode && (
              <button
                onClick={confirmBatchDelete}
                disabled={processing}
                className="text-sm px-3 py-1.5 rounded-lg border border-error text-error hover:bg-error/5 disabled:opacity-50 transition-colors"
              >
                删除
              </button>
            )}
            <button
              onClick={handleViewNovelExtraction}
              className="text-sm px-3 py-1.5 rounded-lg border border-border text-ink-light hover:text-accent hover:border-accent/30 transition-colors"
            >
              查看小说整体提炼
            </button>
            <button
              onClick={handleAIBtnClick}
              disabled={processing || chapters.length === 0}
              className="text-sm px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-white transition-colors"
            >
              {processing ? '处理中...' : 'AI 提炼'}
            </button>
            <button
              onClick={toggleMultiMode}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                multiMode ? 'bg-accent text-white border-accent' : 'border-border text-ink-light hover:border-accent/30'
              }`}
            >
              {multiMode ? '取消多选' : '多选'}
            </button>
          </div>
        </div>

        {pageLoading ? (
          <div className="animate-pulse text-ink-light font-serif text-lg text-center py-20">加载中...</div>
        ) : (!chapters || chapters.length === 0) ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-ink-light text-sm mb-4">还没有章节，点击下方按钮新增。</p>
          </div>
        ) : (
          <div className="space-y-2">
            {multiMode && (
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
                <span className="text-xs text-ink-light">已选择 {selectedIds.size} 个章节</span>
              </div>
            )}

            {chapters.map((ch) => {
              const st = extractStatusLabel[ch.parse_status] || extractStatusLabel.not_parsed;

              let chapterBtnLabel = '提炼';
              if (ch.parse_status === 'parsed') chapterBtnLabel = '查看提炼';
              else if (ch.parse_status === 'parse_failed') chapterBtnLabel = '重新提炼';

              return (
                <div
                  key={ch.id}
                  className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {multiMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ch.id)}
                        onChange={() => toggleSelect(ch.id)}
                        className="w-4 h-4 accent-accent shrink-0"
                      />
                    )}
                    <span className="text-sm text-ink-light shrink-0 w-8">{ch.chapter_index}.</span>
                    <div
                      className="min-w-0 flex-1 cursor-pointer group"
                      onClick={() => router.push(`/novels/${novelId}/chapter/${ch.id}`)}
                    >
                      <span className="text-sm font-medium text-ink group-hover:text-accent group-hover:underline transition-colors">
                        {ch.title}
                      </span>
                      <span className="ml-3 text-xs text-ink-light">{ch.word_count} 字</span>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => handleSingleExtract(ch.id)}
                      disabled={processing}
                      className="text-xs text-accent hover:text-accent-hover disabled:opacity-50 transition-colors"
                    >
                      {chapterBtnLabel}
                    </button>
                    <button
                      onClick={() => confirmSingleDelete(ch.id)}
                      disabled={processing}
                      className="text-xs text-error hover:text-error/80 disabled:opacity-50 transition-colors"
                    >
                      删除
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

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4">
              <p className="text-sm text-ink">
                {deleteTarget.type === 'single'
                  ? '确定要删除该章节吗？删除后不可恢复。'
                  : `确定要删除选中的 ${deleteTarget.ids.length} 个章节吗？删除后不可恢复。`}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm text-ink-light hover:text-ink border border-border rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={executeDelete}
                  disabled={processing}
                  className="px-4 py-2 text-sm bg-error text-white rounded-lg hover:bg-error/90 disabled:opacity-50 transition-colors"
                >
                  {processing ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
