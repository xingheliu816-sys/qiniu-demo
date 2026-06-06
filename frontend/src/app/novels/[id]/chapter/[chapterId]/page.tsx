'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';

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

export default function ChapterEditPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const novelId = Number(params.id);
  const chapterId = Number(params.chapterId);

  const [novelTitle, setNovelTitle] = useState('');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [parseStatus, setParseStatus] = useState('not_parsed');
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  const loadChapter = useCallback(async () => {
    if (!username) return;
    try {
      const detail = await api.getNovel(novelId);
      if (detail.success && detail.novel) {
        setNovelTitle(detail.novel.title);
      }
      const ch = await api.getChapter(chapterId);
      if (ch.success && ch.chapter) {
        setChapterIndex(ch.chapter.chapter_index);
        setTitle(ch.chapter.title);
        setContent(ch.chapter.content || '');
        setParseStatus(ch.chapter.parse_status);
      } else {
        showToast('章节不存在或无权访问', 'error');
      }
    } catch {
      showToast('加载失败', 'error');
    }
  }, [username, novelId, chapterId]);

  useEffect(() => {
    const timer = window.setTimeout(loadChapter, 0);
    return () => window.clearTimeout(timer);
  }, [loadChapter]);

  async function handleSave() {
    if (!title.trim()) {
      showToast('章节标题不能为空', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.saveChapter(chapterId, { title, content });
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch {
      showToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleParseAfterSave() {
    if (!title.trim()) {
      showToast('章节标题不能为空', 'error');
      return;
    }
    setParsing(true);
    try {
      const saveRes = await api.saveChapter(chapterId, { title, content });
      if (!saveRes.success) {
        showToast('保存失败', 'error');
        setParsing(false);
        return;
      }
      const parseRes = await api.parseChapter(chapterId);
      if (parseRes.success) {
        setParseStatus('parsed');
        showToast(parseRes.message, 'success');
      } else {
        setParseStatus('parse_failed');
        showToast(parseRes.message, 'error');
      }
    } catch {
      showToast('提炼失败', 'error');
    } finally {
      setParsing(false);
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

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">{novelTitle || '未命名'}</h2>
          <p className="text-sm text-ink-light mt-1">
            第 {chapterIndex} 章 · 编辑
            {parseStatus === 'parsed' && <span className="ml-2 text-success">(已提炼)</span>}
            {parseStatus === 'parse_failed' && <span className="ml-2 text-error">(提炼失败)</span>}
            {parseStatus === 'not_parsed' && <span className="ml-2 text-ink-light">(未提炼)</span>}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">章节标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入章节标题"
            maxLength={255}
            className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">正文</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入正文"
            className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-y min-h-[300px]"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <button
            onClick={() => router.push(`/novels/${novelId}/import`)}
            className="text-sm text-ink-light hover:text-ink transition-colors underline underline-offset-2"
          >
            返回章节列表
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? '保存中...' : '保存草稿'}
            </button>
            <button
              onClick={handleParseAfterSave}
              disabled={parsing}
              className="px-4 py-2 bg-success hover:bg-success/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {parsing ? '识别中...' : '提炼当前章节'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
