'use client';

import { useState, useRef } from 'react';
import * as api from '@/lib/api';

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

export default function ImportForm({ onSuccess }: { onSuccess: (novelId: number) => void }) {
  const [tab, setTab] = useState<'file' | 'link'>('file');
  const [link, setLink] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md'].includes(ext || '')) {
      showToast('当前仅支持 .txt 和 .md 文件', 'error');
      e.target.value = '';
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileContent((ev.target?.result as string) || '');
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function handleFileImport() {
    if (!fileContent.trim()) {
      showToast('请先选择文件', 'error');
      return;
    }
    setImporting(true);
    try {
      const data = await api.importNovelFile(fileName, fileContent);
      if (data.success && data.novelId) {
        showToast('导入成功', 'success');
        onSuccess(data.novelId);
      } else {
        showToast(data.message || '导入失败', 'error');
      }
    } catch {
      showToast('导入失败', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function handleLinkImport() {
    if (!link.trim()) {
      showToast('请输入小说链接', 'error');
      return;
    }
    setImporting(true);
    try {
      const data = await api.importNovelLink(link.trim());
      if (data.success && data.novelId) {
        showToast('导入成功', 'success');
        onSuccess(data.novelId);
      } else {
        showToast(data.message || '导入失败', 'error');
      }
    } catch {
      showToast('链接解析失败，请检查链接是否可访问，或改用文件导入。', 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          onClick={() => setTab('file')}
          className={`text-sm px-3 py-1 rounded-t transition-colors ${tab === 'file' ? 'bg-accent/10 text-accent font-medium' : 'text-ink-light hover:text-ink'}`}
        >
          文件导入
        </button>
        <button
          onClick={() => setTab('link')}
          className={`text-sm px-3 py-1 rounded-t transition-colors ${tab === 'link' ? 'bg-accent/10 text-accent font-medium' : 'text-ink-light hover:text-ink'}`}
        >
          链接导入
        </button>
      </div>

      {tab === 'file' ? (
        <div className="space-y-3">
          <div className="border border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />
            {fileName ? (
              <div>
                <p className="text-sm text-ink">{fileName}</p>
                <p className="text-xs text-ink-light mt-1">{fileContent.length} 字符</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-accent hover:text-accent-hover mt-2 transition-colors"
                >
                  重新选择
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-accent hover:text-accent-hover transition-colors"
                >
                  点击选择文件
                </button>
                <p className="text-xs text-ink-light mt-2">支持 .txt / .md 格式</p>
              </div>
            )}
          </div>
          {fileContent && (
            <button
              onClick={handleFileImport}
              disabled={importing}
              className="w-full px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {importing ? '导入中...' : '导入'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="输入小说链接，如 https://example.com/novel"
            className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
          />
          <p className="text-xs text-ink-light">系统将尝试访问该链接并识别小说章节内容。复杂网站可能不支持，届时请改用文件导入。</p>
          <button
            onClick={handleLinkImport}
            disabled={importing || !link.trim()}
            className="w-full px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      )}
    </div>
  );
}
