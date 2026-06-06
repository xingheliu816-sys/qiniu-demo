'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function SchemasPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const [systemSchemas, setSystemSchemas] = useState<api.SchemaItem[]>([]);
  const [userSchemas, setUserSchemas] = useState<api.SchemaItem[]>([]);
  const [defaultId, setDefaultId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  function loadSchemas() {
    if (!username) return;
    setLoading(true);
    api.getSchemas().then((data) => {
      if (data.success) {
        setSystemSchemas(data.system_schemas);
        setUserSchemas(data.user_schemas);
        setDefaultId(data.default_schema_id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { loadSchemas(); }, [username]);

  async function handleCopy(id: number) {
    const data = await api.copySchema(id);
    if (data.success) { setMsg('Schema 复制成功'); loadSchemas(); }
    else { setMsg(data.message || '复制失败'); }
  }

  async function handleSetDefault(id: number | null) {
    const data = await api.setDefaultSchema(id);
    if (data.success) { setMsg(id ? '已设为默认' : '已取消默认'); setDefaultId(id); }
    else { setMsg(data.message || '操作失败'); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const data = await api.deleteSchema(deleteTarget.id);
    if (data.success) { setMsg('Schema 已删除'); loadSchemas(); }
    else { setMsg(data.message || '删除失败'); }
    setDeleteTarget(null);
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!username) return null;

  function SchemaCard({ schema, isDefault, onView, onEdit, onCopy, onDelete, onSetDefault }: {
    schema: api.SchemaItem; isDefault: boolean; onView: () => void;
    onEdit?: () => void; onCopy: () => void; onDelete?: () => void; onSetDefault: () => void;
  }) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
            <div className="flex items-center gap-2">
              <h4 className="text-base font-serif font-bold text-ink truncate">{schema.name}</h4>
              {isDefault && <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent shrink-0">默认</span>}
              {schema.is_system === 1 && <span className="px-2 py-0.5 rounded text-xs font-medium bg-ink-light/10 text-ink-light shrink-0">系统</span>}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-light flex-wrap">
              <span>{schemaTypeMap[schema.schema_type || ''] || schema.schema_type || '自定义'}</span>
              <span>{formatMap[schema.content_format] || schema.content_format}</span>
              {schema.description && <span className="truncate max-w-[200px]">{schema.description}</span>}
              <span>{sourceTypeMap[schema.source_type] || schema.source_type}</span>
              <span>{schema.updated_at ? schema.updated_at.substring(0, 10) : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && <button onClick={onEdit} className="px-2.5 py-1 text-xs font-medium bg-surface hover:bg-border text-ink-light rounded-lg transition-colors">编辑</button>}
            <button onClick={onCopy} className="px-2.5 py-1 text-xs font-medium bg-surface hover:bg-border text-ink-light rounded-lg transition-colors">复制</button>
            {onDelete && <button onClick={onDelete} className="px-2.5 py-1 text-xs font-medium text-error hover:bg-error/5 rounded-lg transition-colors">删除</button>}
            <button onClick={onSetDefault} className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${isDefault ? 'bg-warning/10 text-warning' : 'bg-surface hover:bg-border text-ink-light'}`}>
              {isDefault ? '取消默认' : '设为默认'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-serif font-bold text-ink">YAML Schema 规则库</h2>
          <button onClick={() => router.push('/schemas/new')} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">新建 Schema</button>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-2 bg-success/10 text-success text-sm rounded-lg flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg(null)} className="text-success/70 hover:text-success">✕</button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-sm text-ink-light">加载中...</div>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-medium text-ink-light mb-3">系统默认 Schema</h3>
              {systemSchemas.length === 0 ? (
                <p className="text-sm text-ink-light">暂无系统默认 Schema</p>
              ) : (
                <div className="space-y-2">
                  {systemSchemas.map((schema) => (
                    <SchemaCard key={schema.id} schema={schema} isDefault={defaultId === schema.id}
                      onView={() => router.push(`/schemas/${schema.id}`)}
                      onCopy={() => handleCopy(schema.id)}
                      onSetDefault={() => handleSetDefault(defaultId === schema.id ? null : schema.id)} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink-light mb-3">我的 Schema</h3>
              {userSchemas.length === 0 ? (
                <div className="text-center py-8 bg-card border border-dashed border-border rounded-xl">
                  <p className="text-sm text-ink-light">当前未添加 Schema，请点击添加。</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userSchemas.map((schema) => (
                    <SchemaCard key={schema.id} schema={schema} isDefault={defaultId === schema.id}
                      onView={() => router.push(`/schemas/${schema.id}`)}
                      onEdit={() => router.push(`/schemas/${schema.id}/edit`)}
                      onCopy={() => handleCopy(schema.id)}
                      onDelete={() => setDeleteTarget({ id: schema.id, name: schema.name })}
                      onSetDefault={() => handleSetDefault(defaultId === schema.id ? null : schema.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {deleteTarget && (
        <ConfirmModal message={`确定要删除 Schema「${deleteTarget.name}」吗？删除后不可恢复。`}
          onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
