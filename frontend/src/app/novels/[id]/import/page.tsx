'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import ConfirmModal from '@/app/novels/ConfirmModal';

function escapeHtml(text: string) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

export default function NovelImportPage() {
  const { username, isLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const novelId = Number(params.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<api.ParseResult | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [chapterTitles, setChapterTitles] = useState<Record<number, string>>({});
  const [saveTimers, setSaveTimers] = useState<Record<number, ReturnType<typeof setTimeout>>>({});
  const [novelLoading, setNovelLoading] = useState(true);
  const [novelError, setNovelError] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !username) {
      router.replace('/login');
    }
  }, [isLoading, username, router]);

  useEffect(() => {
    if (username && novelId) {
      api.getNovel(novelId)
        .then((data) => {
          if (data.success && data.novel) {
            setTitle(data.novel.title);
            setContent(data.novel.original_text || '');
          }
        })
        .catch(() => {
          setNovelError('小说项目不存在或无权访问');
        })
        .finally(() => setNovelLoading(false));
    } else if (username && !novelId) {
      const timer = window.setTimeout(() => {
        setNovelError('小说项目不存在');
        setNovelLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [username, novelId]);

  const showModal = useCallback((chapterTitles: string[]) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const box = document.createElement('div');
    box.className = 'bg-card rounded-xl p-7 max-w-md w-[90%] shadow-xl';
    box.innerHTML = `
      <h3 class="text-lg font-serif font-bold text-ink mb-3">章节识别完成</h3>
      <ol class="list-decimal pl-5 space-y-1 text-sm text-ink mb-4">
        ${chapterTitles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
      </ol>
      <p class="text-xs text-ink-light mb-5">如果章节识别有误，请检查小说正文中的章节标题格式，或手动修改章节标题。</p>
      <button class="w-full py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">知道了</button>
    `;
    box.querySelector('button')?.addEventListener('click', () => overlay.remove());
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }, []);

  async function handleParse() {
    if (!content.trim()) {
      showToast('小说正文不能为空', 'error');
      return;
    }
    setParsing(true);
    try {
      const detectedType = fileInputRef.current?.files?.length ? 'txt_upload' : 'paste';
      const data = await api.parseChaptersWithNovel(novelId, title, content, detectedType, chapterName);
      if (!data.success) {
        showToast(data.message, 'error');
        return;
      }
      setResult(data);
      setChapterTitles({});
      const titles: Record<number, string> = {};
      data.chapters.forEach(ch => { titles[ch.index] = ch.title; });
      setChapterTitles(titles);
      showModal(data.chapters.map(ch => ch.title));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '识别失败', 'error');
    } finally {
      setParsing(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-medium z-50 shadow-lg animate-in fade-in ${
      type === 'success' ? 'bg-success text-white' : 'bg-error text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async function handleReparse() {
    await handleParse();
  }

  function handleClear() {
    setShowClearConfirm(true);
  }

  function handleClearConfirmed() {
    setShowClearConfirm(false);
    setTitle('');
    setChapterName('');
    setContent('');
    setFileName('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.txt')) {
      showToast('只支持 .txt 文件', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string || '';
      setFileName(file.name);
      const novelTitle = file.name.replace(/\.txt$/i, '').trim();
      setTitle(novelTitle);
      const chapterPattern = /^(第[零一二三四五六七八九十百千万\d]+章\s*.*|第\d+章\s*.*|Chapter\s+\d+.*|序章\s*.*|楔子\s*.*|番外\s*.*)$/im;
      const lines = text.split('\n');
      let detectedChapter = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && chapterPattern.test(trimmed)) {
          detectedChapter = trimmed;
          break;
        }
      }
      if (detectedChapter) setChapterName(detectedChapter);
      setContent(text);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function toggleChapter(index: number) {
    setExpandedChapters(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleTitleChange(index: number, value: string) {
    setChapterTitles(prev => ({ ...prev, [index]: value }));
    if (saveTimers[index]) clearTimeout(saveTimers[index]);
    const timer = setTimeout(async () => {
      const chapter = result?.chapters.find(ch => ch.index === index);
      if (!chapter?.id) return;
      try {
        await api.updateChapterTitle(chapter.id, value);
        showToast('章节标题已保存', 'success');
      } catch {
        showToast('保存失败', 'error');
      }
    }, 800);
    setSaveTimers(prev => ({ ...prev, [index]: timer }));
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  async function handleSave() {
    try {
      const data = await api.saveNovel(novelId);
      if (data.success) {
        showToast('小说已保存', 'success');
      }
    } catch {
      showToast('保存失败', 'error');
    }
  }

  async function handleDeleteNovel() {
    setShowDeleteConfirm(true);
  }

  async function handleDeleteNovelConfirmed() {
    setShowDeleteConfirm(false);
    try {
      const data = await api.deleteNovel(novelId);
      if (data.success) {
        router.replace('/novels');
      }
    } catch {
      showToast('删除失败', 'error');
    }
  }

  if (isLoading || novelLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
      </div>
    );
  }

  if (novelError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-error text-sm mb-4">{novelError}</p>
        <button onClick={() => router.push('/novels')} className="text-accent hover:text-accent-hover text-sm underline underline-offset-2">
          返回我的小说列表
        </button>
      </div>
    );
  }

  if (!username) return null;

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-serif font-bold text-lg text-ink">Novel2Script AI</span>
            <button onClick={() => router.push('/novels')} className="text-sm text-ink-light hover:text-ink transition-colors">
              我的小说
            </button>
            <span className="text-sm text-accent font-medium">小说导入</span>
            <button onClick={() => router.push('/history')} className="text-sm text-ink-light hover:text-ink transition-colors">
              历史记录
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleSave} className="text-sm text-success hover:text-success/80 transition-colors">保存</button>
            <button onClick={handleDeleteNovel} className="text-sm text-error hover:text-error/80 transition-colors">删除</button>
            <span className="text-sm text-ink-light">{username}</span>
            <button onClick={handleLogout} className="text-sm text-ink-light hover:text-error transition-colors">退出</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">小说导入与章节识别</h2>
          <p className="text-sm text-ink-light mt-1">粘贴或上传小说正文，自动识别章节并统计字数。</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div>
            <label htmlFor="title-input" className="block text-sm font-medium text-ink mb-1.5">
              小说标题
            </label>
            <input
              id="title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入标题"
              maxLength={255}
              className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="chapter-input" className="block text-sm font-medium text-ink mb-1.5">
              章节
            </label>
            <input
              id="chapter-input"
              type="text"
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              placeholder="请输入章节"
              maxLength={255}
              className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="content-input" className="block text-sm font-medium text-ink mb-1.5">
              小说正文
            </label>
            <textarea
              id="content-input"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              placeholder="请粘贴小说正文，或上传 .txt 文件"
              className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-y min-h-[200px]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center px-3.5 py-2 bg-card border border-border rounded-lg text-sm text-ink-light hover:text-ink hover:border-ink-light/40 cursor-pointer transition-colors">
                上传 .txt 文件
                <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
              </label>
              {fileName && <span className="text-xs text-ink-light max-w-[180px] truncate">{fileName}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={handleParse} disabled={parsing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${result ? 'hidden' : 'bg-accent hover:bg-accent-hover disabled:opacity-50 text-white'}`}>
                {parsing ? '识别中...' : '识别章节'}
              </button>
              {result && (
                <button onClick={handleReparse} disabled={parsing}
                  className="px-4 py-2 bg-card border border-border rounded-lg text-sm text-ink-light hover:text-ink hover:border-ink-light/40 transition-colors disabled:opacity-50">
                  {parsing ? '识别中...' : '重新识别'}
                </button>
              )}
              <button onClick={handleClear}
                className="px-4 py-2 bg-card border border-error/30 text-error rounded-lg text-sm hover:bg-error/5 hover:border-error/60 transition-colors">
                清空内容
              </button>
            </div>
          </div>
        </div>

        {result && (
          <>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
                result.isEnoughChapters ? 'bg-success/10 border border-success/20 text-success' :
                result.chapterCount > 0 ? 'bg-warning/10 border border-warning/20 text-warning' : 'bg-error/10 border border-error/20 text-error'
              }`}>
                {result.message}
              </div>
              <div className="flex gap-10">
                <div className="text-center">
                  <span className="block text-xs text-ink-light mb-1">总字数</span>
                  <span className="block text-3xl font-bold text-ink font-serif">{result.totalWordCount}</span>
                </div>
                <div className="text-center">
                  <span className="block text-xs text-ink-light mb-1">章节数量</span>
                  <span className="block text-3xl font-bold text-ink font-serif">{result.chapterCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <h3 className="text-base font-serif font-bold text-ink">章节列表</h3>
              </div>
              <div className="px-6 pb-5 space-y-2">
                {result.chapters.map((ch) => (
                  <div key={ch.index} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-paper/50 hover:bg-paper cursor-pointer transition-colors"
                      onClick={() => toggleChapter(ch.index)}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs text-ink-light shrink-0">{ch.index}.</span>
                        <input type="text"
                          value={chapterTitles[ch.index] ?? ch.title}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleTitleChange(ch.index, e.target.value)}
                          className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-border focus:border-accent focus:bg-card px-2 py-0.5 rounded text-sm font-medium text-ink outline-none transition-colors" />
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs text-ink-light">{ch.wordCount} 字</span>
                        <span className="text-xs text-accent font-medium">{expandedChapters.has(ch.index) ? '收起' : '展开'}</span>
                      </div>
                    </div>
                    {expandedChapters.has(ch.index) && (
                      <div className="px-4 py-3.5 border-t border-border text-sm text-ink leading-relaxed whitespace-pre-wrap bg-paper/30 max-h-80 overflow-y-auto">
                        {ch.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="text-center">
          <button onClick={() => router.push('/novels')}
            className="text-sm text-ink-light hover:text-ink underline underline-offset-2 transition-colors">
            返回我的小说列表
          </button>
        </div>
      </main>

      {showClearConfirm && (
        <ConfirmModal
          message="确定要清空小说标题和正文内容吗？此操作不可恢复。"
          onConfirm={handleClearConfirmed}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          message="确定要删除此小说吗？所有章节数据将被永久删除，此操作不可恢复。"
          onConfirm={handleDeleteNovelConfirmed}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
