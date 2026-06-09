'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';

export default function RelationshipGraphEntry() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const [novels, setNovels] = useState<api.NovelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  useEffect(() => {
    if (!username) return;
    api.getNovels()
      .then(d => { if (d.success) setNovels(d.novels || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  if (isLoading || loading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!username) return null;

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <div className="fixed right-3 top-3 z-40"><BackButton /></div>
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">关系图谱</h2>
          <p className="text-sm text-ink-light mt-1">根据已完成提炼的章节内容，生成小说人物、故事、地点和事件关系网络。</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-ink">选择小说</h3>
          {novels.length === 0 ? (
            <p className="text-sm text-ink-light py-6 text-center">当前暂无小说，请先创建或导入小说。</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {novels.map(novel => (
                <button key={novel.id}
                  onClick={() => router.push(`/relationship-graph/${novel.id}`)}
                  className="text-left p-4 border border-border rounded-lg hover:border-accent/30 hover:bg-paper/30 transition-colors">
                  <div className="text-sm font-medium text-ink truncate">{novel.title || '未命名'}</div>
                  <div className="text-xs text-ink-light mt-1">{novel.chapter_count} 章</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-ink-light/60">
          提示：进入小说后，可选择已提炼章节生成关系图谱，或追加新提炼章节到已有图谱中。
        </div>
      </main>
    </div>
  );
}
