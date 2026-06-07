'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';

export default function NewSchemaPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaType, setSchemaType] = useState('custom');
  const [contentFormat, setContentFormat] = useState('yaml');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoading && !username) router.replace('/login');
  if (!username) return null;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'yaml' || ext === 'yml') setContentFormat('yaml');
    else if (ext === 'json') setContentFormat('json');
    if (!name) setName(file.name.replace(/\.\w+$/, ''));
  }

  async function handleSubmit() {
    if (!content.trim()) { setError('Schema 内容不能为空'); return; }
    setSaving(true); setError(null);
    try {
      const data = await api.createSchema({
        name: name.trim() || undefined, description: description.trim() || undefined,
        schemaType: schemaType || undefined, contentFormat, content: content.trim(),
      });
      if (data.success && data.schemaId) router.push(`/schemas/${data.schemaId}`);
      else setError(data.message || '创建失败');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '创建失败'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <div className="fixed right-3 top-3 z-40">
        <BackButton href="/schemas" />
      </div>
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-serif font-bold text-ink mb-4">新建 Schema</h2>
        </div>
        {error && <div className="mb-4 px-4 py-2 bg-error/10 text-error text-sm rounded-lg">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Schema 名称（可选）"
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">描述</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Schema 描述（可选）"
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink mb-1">类型</label>
              <select value={schemaType} onChange={(e) => setSchemaType(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors">
                <option value="custom">自定义</option>
                <option value="short_drama">短剧</option>
                <option value="movie">电影</option>
                <option value="tv_series">电视剧</option>
                <option value="audio_drama">广播剧</option>
                <option value="stage_play">舞台剧</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink mb-1">内容格式</label>
              <select value={contentFormat} onChange={(e) => setContentFormat(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors">
                <option value="yaml">YAML</option><option value="json">JSON</option><option value="text">Text</option>
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-ink">内容</label>
              <label className="text-xs text-accent hover:text-accent-hover cursor-pointer">
                上传文件
                <input type="file" accept=".yaml,.yml,.json,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={`在此输入 ${contentFormat.toUpperCase()} 格式的 Schema 内容`} rows={16}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink font-mono focus:outline-none focus:border-accent transition-colors resize-y" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={saving}
              className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => router.push('/schemas')}
              className="px-6 py-2 bg-surface hover:bg-border text-ink-light text-sm font-medium rounded-lg transition-colors">取消</button>
          </div>
        </div>
      </main>
    </div>
  );
}
