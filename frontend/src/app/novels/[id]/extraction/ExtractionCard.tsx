'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface ExtractionCardProps {
  title: string;
  subtitle?: string;
  value: unknown;
  onChange: (next: unknown) => void;
  onOpenSourceRef?: (chapterId: number, startOffset: number, endOffset: number) => void;
  onDeleteSection?: () => void;
  showDelete?: boolean;
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

function parseJsonOrKeep(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

function isObjectRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isObjectArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && v.every(item => isObjectRecord(item));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(item => typeof item === 'string');
}

interface SourceRefRow {
  chapter_id?: number;
  chapter_title?: string;
  start_offset?: number;
  end_offset?: number;
}

function extractSourceRefs(record: Record<string, unknown>): SourceRefRow[] {
  const refs = record.source_refs;
  if (!Array.isArray(refs)) return [];
  return refs.filter(isObjectRecord) as SourceRefRow[];
}

function getItemLabel(item: Record<string, unknown>): string {
  return (item.name as string) || (item.title as string) || (item.summary as string) || (item.question as string) || (item.motif as string) || (item.event_name as string) || ((item.from && item.to) ? `${item.from} 与 ${item.to}` : '') || (item.content as string) || '';
}

// ============= 子组件 =============

function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.max(el.scrollHeight, 36) + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className || 'w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-none overflow-hidden min-h-[36px]'}
    />
  );
}

function ConfirmDialog({ open, message, onConfirm, onCancel }: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-ink">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-ink-light hover:text-ink border border-border rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-error text-white rounded-lg hover:bg-error/90 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

function AddFieldDialog({ open, onConfirm, onCancel }: {
  open: boolean;
  onConfirm: (name: string, value: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setValue('');
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-bold text-ink">添加字段</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-ink-light mb-1">字段名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：summary"
              className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-light mb-1">字段值（可选）</label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="字段值内容"
              className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent resize-none"
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-ink-light hover:text-ink border border-border rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (name.trim()) {
                onConfirm(name.trim(), value);
                setName('');
                setValue('');
              }
            }}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
}

/** 数组段中每一项的可折叠卡片。 */
function CollapsibleArrayItem({
  item,
  index,
  renderSourceRefs,
  onItemFieldChange,
  onItemValueChange,
  onRequestDelete,
  onRequestAddField,
  onRequestDeleteField,
}: {
  item: Record<string, unknown>;
  index: number;
  renderSourceRefs: (refs: SourceRefRow[]) => ReactNode;
  onItemFieldChange: (key: string, v: string) => void;
  onItemValueChange: (key: string, parsedValue: unknown) => void;
  onRequestDelete: () => void;
  onRequestAddField: () => void;
  onRequestDeleteField: (key: string) => void;
}) {
  const [itemOpen, setItemOpen] = useState(true);
  const label = getItemLabel(item);
  const sourceRefs = extractSourceRefs(item);
  const [delFieldKey, setDelFieldKey] = useState<string | null>(null);
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-paper/30">
      <div className="flex items-center justify-between px-3 py-2 bg-paper/50 border-b border-border">
        <button
          type="button"
          onClick={() => setItemOpen(o => !o)}
          className="flex-1 text-left text-sm font-medium text-ink hover:text-accent transition-colors truncate"
        >
          {index + 1}. {label || `项目 ${index + 1}`}
        </button>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => setItemOpen(o => !o)}
            className="text-xs text-ink-light hover:text-accent transition-colors"
          >
            {itemOpen ? '收起' : '展开'}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            className="text-xs text-error hover:text-error/80 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
      {itemOpen && (
        <div className="p-3 space-y-2">
          {Object.entries(item).filter(([k]) => k !== 'source_refs').map(([key, fieldValue]) => {
            if (typeof fieldValue === 'string') {
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="block text-xs text-ink-light">{key}</label>
                    <button
                      type="button"
                      onClick={() => setDelFieldKey(key)}
                      className="text-[10px] text-error/60 hover:text-error transition-colors"
                    >
                      删除
                    </button>
                  </div>
                  <AutoTextarea
                    value={fieldValue}
                    onChange={(v) => onItemFieldChange(key, v)}
                  />
                </div>
              );
            }
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-xs text-ink-light">{key}</label>
                  <button
                    type="button"
                    onClick={() => setDelFieldKey(key)}
                    className="text-[10px] text-error/60 hover:text-error transition-colors"
                  >
                    删除
                  </button>
                </div>
                <AutoTextarea
                  value={asString(fieldValue)}
                  onChange={(v) => onItemValueChange(key, parseJsonOrKeep(v))}
                />
              </div>
            );
          })}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onRequestAddField}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              + 添加字段
            </button>
          </div>
          {sourceRefs.length > 0 && renderSourceRefs(sourceRefs)}
        </div>
      )}
      <ConfirmDialog
        open={delFieldKey !== null}
        message="确定要删除该字段吗？此操作不可恢复。"
        onConfirm={() => {
          if (delFieldKey) onRequestDeleteField(delFieldKey);
          setDelFieldKey(null);
        }}
        onCancel={() => setDelFieldKey(null)}
      />
    </div>
  );
}

// ============= 主组件 =============

export default function ExtractionCard({ title, subtitle, value, onChange, onOpenSourceRef, onDeleteSection, showDelete }: ExtractionCardProps) {
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form');
  const [expanded, setExpanded] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [addFieldForItem, setAddFieldForItem] = useState<number | null>(null);
  const [deleteFieldKey, setDeleteFieldKey] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState('');
  const [showDeleteSection, setShowDeleteSection] = useState(false);

  const valueIsObject = isObjectRecord(value);
  const valueIsObjectArray = isObjectArray(value);
  const valueIsStringArray = isStringArray(value);

  function updateObjectField(key: string, nextValue: string) {
    if (!valueIsObject) return;
    onChange({ ...value, [key]: nextValue });
  }

  function updateArrayItem(index: number, key: string, nextValue: string) {
    if (!valueIsObjectArray) return;
    const next = (value as Record<string, unknown>[]).map((item, i) =>
      i === index ? { ...item, [key]: nextValue } : item
    );
    onChange(next);
  }

  function addArrayItem() {
    if (valueIsObjectArray) {
      const template: Record<string, unknown> = {};
      const keys = Object.keys((value as Record<string, unknown>[])[0] || {});
      keys.forEach(k => { template[k] = ''; });
      onChange([...(value as Record<string, unknown>[]), template]);
    } else if (valueIsStringArray) {
      onChange([...(value as string[]), '']);
    } else {
      onChange([]);
    }
  }

  function removeArrayItem(index: number) {
    if (valueIsObjectArray) {
      onChange((value as Record<string, unknown>[]).filter((_, i) => i !== index));
    } else if (valueIsStringArray) {
      onChange((value as string[]).filter((_, i) => i !== index));
    }
  }

  function updateStringArrayItem(index: number, nextValue: string) {
    if (!valueIsStringArray) return;
    onChange((value as string[]).map((item, i) => i === index ? nextValue : item));
  }

  function handleAddField(name: string, fieldValue: string) {
    if (addFieldForItem !== null && valueIsObjectArray) {
      const next = (value as Record<string, unknown>[]).map((item, i) =>
        i === addFieldForItem ? { ...item, [name]: parseJsonOrKeep(fieldValue) } : item
      );
      onChange(next);
      setAddFieldForItem(null);
    } else if (valueIsObject) {
      onChange({ ...value, [name]: parseJsonOrKeep(fieldValue) });
    }
  }

  function handleDeleteField(key: string) {
    if (addFieldForItem !== null && valueIsObjectArray) {
      const next = (value as Record<string, unknown>[]).map((item, i) => {
        if (i !== addFieldForItem) return item;
        const { [key]: _, ...rest } = item;
        return rest;
      });
      onChange(next);
    } else if (valueIsObject) {
      const { [key]: _, ...rest } = value as Record<string, unknown>;
      onChange(rest);
    }
  }

  function openAddFieldDialog() {
    setAddFieldOpen(true);
    setAddFieldForItem(null);
  }

  function openAddFieldForItem(index: number) {
    setAddFieldForItem(index);
    setAddFieldOpen(true);
  }

  const renderSourceRefs = (refs: SourceRefRow[]) => {
    if (refs.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {refs.map((ref, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onOpenSourceRef?.(ref.chapter_id || 0, ref.start_offset || 0, ref.end_offset || 0)}
            className="text-xs px-2 py-0.5 rounded border border-border bg-paper hover:bg-accent/10 hover:border-accent/40 hover:text-accent transition-colors"
          >
            查看依据 · {ref.chapter_title || `章节 ${ref.chapter_id}`}
          </button>
        ))}
      </div>
    );
  };

  const renderObjectFields = (obj: Record<string, unknown>, prefix?: string, onItemChange?: (path: string, v: string) => void): ReactNode => {
    const fields = Object.entries(obj).filter(([k]) => k !== 'source_refs');
    const sourceRefs = extractSourceRefs(obj);
    return (
      <div className="space-y-2.5">
        {fields.map(([key, fieldValue]) => {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          if (typeof fieldValue === 'string') {
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-ink-light">{key}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteFieldKey(key);
                      setAddFieldForItem(null);
                    }}
                    className="text-[10px] text-error/60 hover:text-error transition-colors"
                  >
                    删除
                  </button>
                </div>
                <AutoTextarea
                  value={fieldValue}
                  onChange={(v) => {
                    if (onItemChange) onItemChange(key, v);
                    else updateObjectField(key, v);
                  }}
                />
              </div>
            );
          }
          if (isObjectRecord(fieldValue)) {
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-ink-light">{key}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteFieldKey(key);
                      setAddFieldForItem(null);
                    }}
                    className="text-[10px] text-error/60 hover:text-error transition-colors"
                  >
                    删除
                  </button>
                </div>
                <div className="ml-3 pl-3 border-l-2 border-border">
                  {renderObjectFields(fieldValue, fieldPath, (subKey, v) => {
                    onChange({ ...obj, [key]: { ...fieldValue, [subKey]: v } });
                  })}
                </div>
              </div>
            );
          }
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-ink-light">{key}</label>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteFieldKey(key);
                    setAddFieldForItem(null);
                  }}
                  className="text-[10px] text-error/60 hover:text-error transition-colors"
                >
                  删除
                </button>
              </div>
              <AutoTextarea
                value={asString(fieldValue)}
                onChange={(v) => {
                  if (onItemChange) onItemChange(key, v);
                  else onChange({ ...obj, [key]: parseJsonOrKeep(v) });
                }}
              />
            </div>
          );
        })}
        {sourceRefs.length > 0 && renderSourceRefs(sourceRefs)}
      </div>
    );
  };

  function handleJsonChange(text: string) {
    setJsonError('');
    onChange(parseJsonOrKeep(text));
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <header
        className="px-5 py-3 border-b border-border bg-paper/40 flex items-center justify-between gap-3 cursor-pointer"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-serif font-bold text-ink truncate">{title}</h3>
            {showDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteSection(true); }}
                className="text-[10px] text-error/50 hover:text-error transition-colors shrink-0"
                title="删除该模块"
              >
                ✕
              </button>
            )}
          </div>
          {subtitle && <p className="text-xs text-ink-light mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'form' | 'json')}
            className="text-xs px-2 py-1 rounded border border-border bg-paper text-ink-light focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="form">表单视图</option>
            <option value="json">JSON 视图</option>
          </select>
          <button
            type="button"
            onClick={() => setExpanded(o => !o)}
            className="text-xs text-ink-light ml-1 cursor-pointer hover:text-accent transition-colors"
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>
      </header>

      {expanded && (
        <div className="p-5">
          {viewMode === 'json' ? (
            <div>
              <AutoTextarea
                value={asString(value)}
                onChange={handleJsonChange}
              />
              {jsonError && <p className="text-xs text-error mt-1">{jsonError}</p>}
            </div>
          ) : valueIsObject ? (
            <div className="space-y-2.5">
              {Object.entries(value).length === 0 && (
                <p className="text-sm text-ink-light italic">暂无内容。</p>
              )}
              {Object.entries(value).map(([key, fieldValue]) => {
                const isSrcRef = key === 'source_refs';
                if (isSrcRef) return null;
                if (isObjectRecord(fieldValue)) {
                  return (
                    <div key={key}>
                      <label className="block text-xs font-medium text-ink-light mb-1.5">{key}</label>
                      <div className="ml-3 pl-3 border-l-2 border-border">
                        {renderObjectFields(fieldValue, key, (subKey, v) => {
                          onChange({ ...value, [key]: { ...fieldValue, [subKey]: v } });
                        })}
                      </div>
                      {extractSourceRefs(fieldValue).length > 0 && renderSourceRefs(extractSourceRefs(fieldValue))}
                    </div>
                  );
                }
                if (typeof fieldValue === 'string') {
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-ink-light">{key}</label>
                        <button
                          type="button"
                          onClick={() => { setDeleteFieldKey(key); setAddFieldForItem(null); }}
                          className="text-[10px] text-error/60 hover:text-error transition-colors"
                        >
                          删除
                        </button>
                      </div>
                      <AutoTextarea
                        value={fieldValue}
                        onChange={(v) => updateObjectField(key, v)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-ink-light">{key}</label>
                      <button
                        type="button"
                        onClick={() => { setDeleteFieldKey(key); setAddFieldForItem(null); }}
                        className="text-[10px] text-error/60 hover:text-error transition-colors"
                      >
                        删除
                      </button>
                    </div>
                    <AutoTextarea
                      value={asString(fieldValue)}
                      onChange={(v) => onChange({ ...value, [key]: parseJsonOrKeep(v) })}
                    />
                  </div>
                );
              })}
              {Object.keys(value).length > 0 && (
                <button
                  type="button"
                  onClick={openAddFieldDialog}
                  className="text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  + 添加字段
                </button>
              )}
            </div>
          ) : valueIsObjectArray ? (
            <div className="space-y-2">
              {(value as Record<string, unknown>[]).length === 0 && (
                <p className="text-sm text-ink-light italic">暂无内容。</p>
              )}
              {(value as Record<string, unknown>[]).map((item, index) => (
                <CollapsibleArrayItem
                  key={index}
                  item={item}
                  index={index}
                  renderSourceRefs={renderSourceRefs}
                  onItemFieldChange={(key, v) => updateArrayItem(index, key, v)}
                  onItemValueChange={(key, parsedValue) => {
                    const next = (value as Record<string, unknown>[]).map((it, i) =>
                      i === index ? { ...it, [key]: parsedValue } : it
                    );
                    onChange(next);
                  }}
                  onRequestDelete={() => setDeleteTarget(index)}
                  onRequestAddField={() => openAddFieldForItem(index)}
                  onRequestDeleteField={(key) => {
                    setAddFieldForItem(index);
                    setDeleteFieldKey(key);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={addArrayItem}
                className="w-full py-2 border border-dashed border-border rounded-lg text-sm text-ink-light hover:text-accent hover:border-accent/40 transition-colors"
              >
                + 添加一项
              </button>
            </div>
          ) : valueIsStringArray ? (
            <div className="space-y-2">
              {(value as string[]).length === 0 && (
                <p className="text-sm text-ink-light italic">暂无内容。</p>
              )}
              {(value as string[]).map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <span className="text-sm text-ink-light pt-1.5 shrink-0">{index + 1}.</span>
                  <AutoTextarea
                    value={item}
                    onChange={(v) => updateStringArrayItem(index, v)}
                    className="flex-1 px-3 py-1.5 bg-paper border border-border rounded text-sm text-ink focus:outline-none focus:border-accent transition-colors resize-none overflow-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => removeArrayItem(index)}
                    className="text-xs text-error hover:text-error/80 transition-colors pt-1.5 shrink-0"
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addArrayItem}
                className="w-full py-1.5 border border-dashed border-border rounded text-sm text-ink-light hover:text-accent hover:border-accent/40 transition-colors"
              >
                + 添加一项
              </button>
            </div>
          ) : (
            <AutoTextarea
              value={asString(value)}
              onChange={(v) => onChange(parseJsonOrKeep(v))}
            />
          )}

          {/* 删除大模块确认 */}
          <ConfirmDialog
            open={showDeleteSection}
            message="确定要删除该模块吗？模块内的内容也会被删除，此操作不可恢复。"
            onConfirm={() => { setShowDeleteSection(false); onDeleteSection?.(); }}
            onCancel={() => setShowDeleteSection(false)}
          />

          {/* 删除小元素确认 */}
          <ConfirmDialog
            open={deleteTarget !== null}
            message="确定要删除该项吗？此操作不可恢复。"
            onConfirm={() => { removeArrayItem(deleteTarget!); setDeleteTarget(null); }}
            onCancel={() => setDeleteTarget(null)}
          />

          {/* 删除字段确认 */}
          <ConfirmDialog
            open={deleteFieldKey !== null}
            message="确定要删除该字段吗？此操作不可恢复。"
            onConfirm={() => { handleDeleteField(deleteFieldKey!); setDeleteFieldKey(null); }}
            onCancel={() => setDeleteFieldKey(null)}
          />

          {/* 添加字段对话框 */}
          <AddFieldDialog
            open={addFieldOpen}
            onConfirm={(name, fieldValue) => { handleAddField(name, fieldValue); setAddFieldOpen(false); }}
            onCancel={() => { setAddFieldOpen(false); setAddFieldForItem(null); }}
          />
        </div>
      )}
    </section>
  );
}
