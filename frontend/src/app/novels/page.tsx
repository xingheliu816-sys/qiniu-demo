'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import ConfirmModal from './ConfirmModal';
import Sidebar from '@/components/Sidebar';

export default function NovelsPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const [novels, setNovels] = useState<api.NovelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    if (!isLoading && !username) {
      router.replace('/login');
    }
  }, [isLoading, username, router]);

  const loadNovels = useCallback(() => {
    if (!username) return;
    setLoading(true);
    api.getNovels()
      .then((data) => {
        if (data.success) setNovels(data.novels);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    const timer = window.setTimeout(loadNovels, 0);
    return () => window.clearTimeout(timer);
  }, [loadNovels]);

  async function handleCreate() {
    setCreating(true);
    try {
      const data = await api.createNovel();
      if (data.success && data.novelId) {
        router.push(`/novels/${data.novelId}/import`);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, novelId: number, novelTitle: string) {
    e.stopPropagation();
    setDeleteTarget({ id: novelId, title: novelTitle });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const data = await api.deleteNovel(deleteTarget.id);
      if (data.success) {
        setNovels(prev => prev.filter(n => n.id !== deleteTarget.id));
      }
    } catch {
      // ignore
    } finally {
      setDeleteTarget(null);
    }
  }

  const statusTextMap: Record<string, { label: string; cls: string }> = {
    draft: { label: '草稿', cls: 'bg-warning/10 text-warning' },
    imported: { label: '已保存', cls: 'bg-success/10 text-success' },
    parsed: { label: '已保存', cls: 'bg-success/10 text-success' },
    parse_failed: { label: '识别失败', cls: 'bg-error/10 text-error' },
  };

  function getNovelStatus(novel: api.NovelItem): { label: string; cls: string } {
    if (novel.chapter_count > 0) {
      return { label: '已有章节', cls: 'bg-success/10 text-success' };
    }
    return statusTextMap[novel.status] || { label: '草稿', cls: 'bg-warning/10 text-warning' };
  }

  const extractionStatusMap: Record<string, { label: string; cta: string; cls: string }> = {
    not_started: { label: '未提炼', cta: '进入提炼', cls: 'text-accent hover:text-accent-hover' },
    extracting: { label: '提炼中', cta: '查看进度', cls: 'text-warning hover:text-warning/80' },
    extracted: { label: '已提炼', cta: '查看提炼', cls: 'text-success hover:text-success/80' },
    editing: { label: '编辑中', cta: '继续编辑', cls: 'text-accent hover:text-accent-hover' },
    confirmed: { label: '已确认', cta: '查看提炼', cls: 'text-success hover:text-success/80' },
    failed: { label: '提炼失败', cta: '重试提炼', cls: 'text-error hover:text-error/80' },
  };

  const drafts = novels.filter(n => n.status === 'draft');
  const saved = novels.filter(n => n.status !== 'draft');

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
      </div>
    );
  }

  if (!username) return null;

  return (
    <div className="flex-1 flex">
      <Sidebar />

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif font-bold text-ink">我的小说</h2>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {creating ? '创建中...' : '创建新小说'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm text-ink-light">加载中...</div>
        ) : novels.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-ink-light">你还没有创建小说项目，点击「创建新小说」开始导入小说。</p>
          </div>
        ) : (
          <div className="space-y-8">
            {saved.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink-light mb-3">已保存</h3>
                <div className="space-y-2">
                  {saved.map((novel) => {
                    const extInfo = extractionStatusMap[novel.extraction_status || 'not_started'] || extractionStatusMap.not_started;
                    const canExtract = novel.status === 'parsed';
                    return (
                      <div key={novel.id} className="bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors cursor-pointer flex items-center justify-between"
                        onClick={() => router.push(`/novels/${novel.id}/import`)}>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-base font-serif font-bold text-ink truncate">{novel.title || '未命名'}</h4>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-ink-light">
                            <span>{novel.total_word_count} 字</span>
                            <span>{novel.chapter_count} 章</span>
                            <span>{novel.updated_at ? novel.updated_at.substring(0, 10) : ''}</span>
                            {canExtract && (
                              <span className="text-ink-light/80">提炼 · {extInfo.label}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${getNovelStatus(novel).cls}`}>
                            {getNovelStatus(novel).label}
                          </span>
                          {canExtract && (
                            <button
                              onClick={(e) => { e.stopPropagation(); router.push(`/novels/${novel.id}/extraction`); }}
                              className={`text-xs font-medium transition-colors ${extInfo.cls}`}
                            >
                              {extInfo.cta}
                            </button>
                          )}
                          <button onClick={(e) => handleDelete(e, novel.id, novel.title)}
                            className="text-xs text-error hover:text-error/80 transition-colors">
                            删除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {drafts.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink-light mb-3">草稿</h3>
                <div className="space-y-2">
                  {drafts.map((novel) => (
                    <div key={novel.id} className="bg-card border border-dashed border-border rounded-xl p-4 hover:border-accent/30 transition-colors cursor-pointer flex items-center justify-between"
                      onClick={() => router.push(`/novels/${novel.id}/import`)}>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-serif font-bold text-ink truncate">{novel.title || '未命名'}</h4>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-ink-light">
                          <span>{novel.total_word_count} 字</span>
                          <span>{novel.chapter_count} 章</span>
                          <span>{novel.updated_at ? novel.updated_at.substring(0, 10) : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-medium ${getNovelStatus(novel).cls}`}>
                          {getNovelStatus(novel).label}
                        </span>
                        <button onClick={(e) => handleDelete(e, novel.id, novel.title)}
                          className="text-xs text-error hover:text-error/80 transition-colors">
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {deleteTarget && (
        <ConfirmModal
          message={`确定要删除"${deleteTarget.title}"吗？此操作不可恢复。`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
