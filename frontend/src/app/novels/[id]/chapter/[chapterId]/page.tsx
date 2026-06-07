'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';
import PageError from '@/components/PageError';

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
  const [pageError, setPageError] = useState<unknown>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'select' | 'text' | 'file'>('select');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  const loadChapter = useCallback(async () => {
    if (!username) return;
    setPageLoading(true);
    setPageError(null);
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
        setPageError({ code: 'NOT_FOUND', message: '章节不存在或无权访问' });
      }
    } catch (err) {
      setPageError(err);
    } finally {
      setPageLoading(false);
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
      // 合并入口：把保存 + 识别前置 + 进入小说提炼合到一次请求
      const res = await api.extractFromChapter(chapterId, { title, content });
      if (!res.success) {
        if (res.stage === 'save') {
          showToast('章节保存失败，请稍后重试。', 'error');
        } else if (res.stage === 'parse') {
          setParseStatus('parse_failed');
          showToast(res.message || '章节内容处理失败，请检查章节正文后重试。', 'error');
        } else {
          setParseStatus('parsed');
          showToast(res.message || 'AI 提炼失败，请稍后重试。', 'error');
        }
      } else {
        setParseStatus('parsed');
      }
      router.push(`/novels/${novelId}/extraction`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '提炼失败', 'error');
      router.push(`/novels/${novelId}/extraction`);
    } finally {
      setParsing(false);
    }
  }

  function openImportModal() {
    setImportModalOpen(true);
    setImportStep('select');
    setImportText('');
    setImportError(null);
    setSelectedFileName(null);
  }

  function closeImportModal() {
    setImportModalOpen(false);
    setImportStep('select');
    setImportText('');
    setImportError(null);
    setSelectedFileName(null);
  }

  function applyImport(newTitle: string, newContent: string) {
    const hasExisting = title.trim() || content.trim();
    if (hasExisting) {
      const ok = window.confirm('导入内容会覆盖当前章节标题和正文，确定继续吗？');
      if (!ok) return false;
    }
    setTitle(newTitle);
    setContent(newContent);
    closeImportModal();
    showToast('章节内容已导入，请检查后保存。', 'success');
    return true;
  }

  async function handleImportText() {
    if (!importText.trim()) { setImportError('章节内容不能为空'); return; }
    setImporting(true);
    setImportError(null);
    try {
      const res = await api.importChapterTextPreview(chapterId, importText);
      if (res.success && res.data) {
        applyImport(res.data.title, res.data.content);
      } else {
        setImportError(res.message || '解析失败');
      }
    } catch {
      setImportError('解析失败');
    } finally {
      setImporting(false);
    }
  }

  async function handleImportFile() {
    if (!fileInputRef.current?.files?.length) { setImportError('请先选择文件。'); return; }
    setImporting(true);
    setImportError(null);
    try {
      const res = await api.importChapterFilePreview(chapterId, fileInputRef.current.files[0]);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[import-file-preview] response =', res);
      }
      if (res.success && res.data) {
        applyImport(res.data.title, res.data.content);
      } else {
        const msg = res.error?.message || res.message || '文件解析失败，请检查文件内容或改用文本转换。';
        setImportError(msg);
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[import-file-preview] error =', err);
      }
      const msg = err instanceof Error && err.message ? err.message : '文件解析失败，请检查文件内容或改用文本转换。';
      setImportError(msg);
    } finally {
      setImporting(false);
    }
  }

  if (isLoading || pageLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
      </div>
    );
  }

  if (pageError) {
    return <PageError error={pageError} onRetry={loadChapter} />;
  }

  if (!username) return null;

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <div className="fixed right-3 top-3 z-40">
        <BackButton />
      </div>
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">{novelTitle || '未命名'}</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-light mt-1">
              第 {chapterIndex} 章 · 编辑
              {parseStatus === 'parsed' && <span className="ml-2 text-success">(已提炼)</span>}
              {parseStatus === 'parse_failed' && <span className="ml-2 text-error">(提炼失败)</span>}
              {parseStatus === 'not_parsed' && <span className="ml-2 text-ink-light">(未提炼)</span>}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={openImportModal} className="text-sm px-3 py-1.5 rounded-lg border border-border text-ink-light hover:text-accent hover:border-accent/30 transition-colors">
                导入章节内容
              </button>
            </div>
          </div>
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
              {parsing ? '提炼中...' : '提炼当前章节'}
            </button>
          </div>
        </div>

        {/* Import Chapter Content Modal */}
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeImportModal}>
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-ink">导入章节内容</h3>
                <button onClick={closeImportModal} className="text-ink-light hover:text-ink text-lg leading-none">&times;</button>
              </div>
              <p className="text-sm text-ink-light">请选择导入方式。导入成功后将填充到当前章节标题和正文中。</p>

              {importStep === 'select' && (
                <div className="space-y-3">
                  <button onClick={() => setImportStep('text')} className="w-full text-left p-4 border border-border rounded-xl hover:border-accent/30 transition-colors">
                    <div className="font-medium text-sm text-ink">文本转换</div>
                    <div className="text-xs text-ink-light mt-1">粘贴章节内容，系统自动识别章节标题和正文，并填充到当前章节。</div>
                  </button>
                  <button onClick={() => setImportStep('file')} className="w-full text-left p-4 border border-border rounded-xl hover:border-accent/30 transition-colors">
                    <div className="font-medium text-sm text-ink">文件导入</div>
                    <div className="text-xs text-ink-light mt-1">当前支持 .txt / .md / .docx。.pdf / .doc 暂不支持，请改用文本转换。</div>
                  </button>
                </div>
              )}

              {importStep === 'text' && (
                <div className="space-y-3">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="请粘贴章节内容，系统会尝试识别章节标题和正文。"
                    rows={8}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink font-mono focus:outline-none focus:border-accent transition-colors resize-y"
                  />
                  {importError && <div className="text-xs text-error">{importError}</div>}
                  <div className="flex gap-3">
                    <button onClick={() => { setImportStep('select'); setImportError(null); setImportText(''); }} className="px-4 py-2 text-sm text-ink-light hover:text-ink border border-border rounded-lg transition-colors">返回选择方式</button>
                    <button onClick={handleImportText} disabled={importing} className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors">{importing ? '导入中...' : '确认转换'}</button>
                  </div>
                </div>
              )}

              {importStep === 'file' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-accent/30 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".txt,.md,.docx" className="hidden" onChange={(e) => { setImportError(null); setSelectedFileName(e.target.files?.[0]?.name || null); }} />
                    <div className="text-sm font-medium text-ink mb-1">点击选择文件</div>
                    <div className="text-xs text-ink-light">当前支持 .txt / .md / .docx，.pdf / .doc 暂不支持</div>
                  </div>
                  {selectedFileName && <div className="text-xs text-ink font-medium">已选择：{selectedFileName}</div>}
                  {importError && <div className="text-xs text-error">{importError}</div>}
                  <div className="flex gap-3">
                    <button onClick={() => { setImportStep('select'); setImportError(null); setSelectedFileName(null); }} className="px-4 py-2 text-sm text-ink-light hover:text-ink border border-border rounded-lg transition-colors">返回选择方式</button>
                    <button onClick={handleImportFile} disabled={importing || !selectedFileName} className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg transition-colors">{importing ? '导入中...' : '确认导入'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
