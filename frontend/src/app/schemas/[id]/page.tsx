'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import ConfirmModal from '@/app/novels/ConfirmModal';

const schemaTypeMap: Record<string, string> = {
  short_drama: '短剧', movie: '电影', tv_series: '电视剧',
  audio_drama: '广播剧', stage_play: '舞台剧', custom: '自定义',
};
const formatMap: Record<string, string> = { yaml: 'YAML', json: 'JSON', text: 'Text' };
const sourceTypeMap: Record<string, string> = {
  manual: '手动创建', upload_yaml: '上传 YAML', upload_json: '上传 JSON',
  copy_system: '复制系统', copy_user: '复制', system_default: '系统默认',
};

export default function SchemaDetailPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const schemaId = Number(params.id);
  const [schema, setSchema] = useState<api.SchemaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  useEffect(() => {
    if (!username || !schemaId) return;
    api.getSchema(schemaId).then((d) => { if (d.success) setSchema(d.schema); }).catch(() => {}).finally(() => setLoading(false));
  }, [username, schemaId]);

  async function handleCopy() {
    if (!schema) return;
    const data = await api.copySchema(schema.id);
    if (data.success && data.schemaId) router.push(`/schemas/${data.schemaId}`);
  }

  async function handleDelete() {
    if (!schema) return;
    await api.deleteSchema(schema.id);
    router.push('/schemas');
  }

  if (isLoading || loading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!username || !schema) return null;

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <button onClick={() => router.push('/schemas')} className="text-sm text-ink-light hover:text-ink transition-colors mb-4">&larr; 返回 Schema 列表</button>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-serif font-bold text-ink">{schema.name}</h2>
                {schema.is_system === 1 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-ink-light/10 text-ink-light">系统</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-light">
                <span>{schemaTypeMap[schema.schema_type || ''] || schema.schema_type || '自定义'}</span>
                <span>{formatMap[schema.content_format] || schema.content_format}</span>
                <span>{sourceTypeMap[schema.source_type] || schema.source_type}</span>
                <span>更新于 {schema.updated_at ? schema.updated_at.substring(0, 10) : ''}</span>
              </div>
              {schema.description && <p className="mt-2 text-sm text-ink-light">{schema.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {schema.is_system === 0 && (
                <button onClick={() => router.push(`/schemas/${schema.id}/edit`)}
                  className="px-3 py-1.5 text-sm font-medium bg-surface hover:bg-border text-ink-light rounded-lg transition-colors">编辑</button>
              )}
              <button onClick={handleCopy} className="px-3 py-1.5 text-sm font-medium bg-surface hover:bg-border text-ink-light rounded-lg transition-colors">复制</button>
              {schema.is_system === 0 && (
                <button onClick={() => setDeleteConfirm(true)} className="px-3 py-1.5 text-sm font-medium text-error hover:bg-error/5 rounded-lg transition-colors">删除</button>
              )}
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <pre className="text-sm font-mono text-ink bg-surface p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">{schema.content}</pre>
          </div>
        </div>
      </main>
      {deleteConfirm && (
        <ConfirmModal message={`确定要删除 Schema「${schema.name}」吗？删除后不可恢复。`}
          onConfirm={handleDelete} onCancel={() => setDeleteConfirm(false)} />
      )}
    </div>
  );
}
