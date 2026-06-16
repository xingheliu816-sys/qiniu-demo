'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';

export default function EditSchemaPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const schemaId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaType, setSchemaType] = useState('custom');
  const [contentFormat, setContentFormat] = useState('yaml');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSystem, setIsSystem] = useState(false);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  useEffect(() => {
    if (!username || !schemaId) return;
    api.getSchema(schemaId).then((data) => {
      if (data.success) {
        setIsSystem(data.schema.is_system === 1);
        setName(data.schema.name); setDescription(data.schema.description || '');
        setSchemaType(data.schema.schema_type || 'custom');
        setContentFormat(data.schema.content_format); setContent(data.schema.content);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [username, schemaId]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setContent(await file.text());
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'yaml' || ext === 'yml') setContentFormat('yaml');
    else if (ext === 'json') setContentFormat('json');
  }

  async function handleSubmit() {
    if (!content.trim()) { setError('Schema 内容不能为空'); return; }
    setSaving(true); setError(null);
    try {
      const data = await api.updateSchema(schemaId, {
        name: name.trim() || undefined, description: description.trim() || undefined,
        schemaType: schemaType || undefined, contentFormat, content: content.trim(),
      });
      if (data.success) router.push(`/schemas/${schemaId}`);
      else setError(data.message || '保存失败');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : '保存失败'); }
    finally { setSaving(false); }
  }

  if (isLoading || loading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!username) return null;

  if (isSystem) {
    return (
      <div className="flex-1 flex">
        <Sidebar />
        <div className="fixed right-3 top-3 z-40">
          <BackButton href="/schemas" />
        </div>
        <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
          <p className="text-center py-16 text-sm text-ink-light">系统默认 Schema 不允许编辑。</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <div className="fixed right-3 top-3 z-40">
        <BackButton href={`/schemas/${schemaId}`} />
      </div>
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-bold text-ink">编辑 Schema</h2>
        </div>
        {error && <div className="mb-4 px-4 py-2 bg-error/10 text-error text-sm rounded-lg">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">描述</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink mb-1">类型</label>
              <select value={schemaType} onChange={(e) => setSchemaType(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent transition-colors">
                <option value="custom">自定义</option><option value="short_drama">短剧</option>
                <option value="movie">电影</option><option value="tv_series">电视剧</option>
                <option value="audio_drama">广播剧</option><option value="stage_play">舞台剧</option>
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
                上传文件替换
                <input type="file" accept=".yaml,.yml,.json,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={16}
              className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-ink font-mono focus:outline-none focus:border-accent transition-colors resize-y" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} disabled={saving}
              className="px-6 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">{saving ? '保存中...' : '保存'}</button>
            <button onClick={() => router.push(`/schemas/${schemaId}`)}
              className="px-6 py-2 bg-surface hover:bg-border text-ink-light text-sm font-medium rounded-lg transition-colors">取消</button>
          </div>
        </div>
      </main>
    </div>
  );
}
