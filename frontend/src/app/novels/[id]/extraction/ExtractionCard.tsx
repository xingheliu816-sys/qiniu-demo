'use client';

import { useState } from 'react';

interface ExtractionCardProps {
  title: string;
  subtitle?: string;
  value: unknown;
  onChange: (next: unknown) => void;
  onOpenSourceRef?: (chapterId: number, startOffset: number, endOffset: number) => void;
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

function parseJsonOrKeep(text: string, fallback: unknown): unknown {
  const trimmed = text.trim();
  if (!trimmed) return Array.isArray(fallback) ? [] : (typeof fallback === 'object' && fallback !== null ? {} : '');
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
  return Array.isArray(v) && v.every(item => isObjectRecord(item));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(item => typeof item === 'string');
}

interface SourceRefRow {
  chapter_id?: number;
  chapter_title?: string;
  start_offset?: number;
  end_offset?: number;
  excerpt_preview?: string;
}

function extractSourceRefs(record: Record<string, unknown>): SourceRefRow[] {
  const refs = record.source_refs;
  if (!Array.isArray(refs)) return [];
  return refs.filter(isObjectRecord) as SourceRefRow[];
}

export default function ExtractionCard({ title, subtitle, value, onChange, onOpenSourceRef }: ExtractionCardProps) {
  const [rawMode, setRawMode] = useState(false);

  const valueIsObject = isObjectRecord(value);
  const valueIsObjectArray = isObjectArray(value);
  const valueIsStringArray = isStringArray(value);

  function updateObjectField(key: string, nextValue: string) {
    if (!valueIsObject) return;
    onChange({ ...value, [key]: nextValue });
  }

  function updateArrayItem(index: number, key: string, nextValue: string) {
    if (!valueIsObjectArray) return;
    const next = value.map((item, i) => i === index ? { ...item, [key]: nextValue } : item);
    onChange(next);
  }

  function addArrayItem() {
    if (valueIsObjectArray) {
      const template = value[0] ? Object.fromEntries(Object.keys(value[0]).map(k => [k, ''])) : { name: '', summary: '' };
      onChange([...value, template]);
    } else if (valueIsStringArray) {
      onChange([...value, '']);
    }
  }

  function removeArrayItem(index: number) {
    if (valueIsObjectArray) {
      onChange(value.filter((_, i) => i !== index));
    } else if (valueIsStringArray) {
      onChange(value.filter((_, i) => i !== index));
    }
  }

  function updateStringArrayItem(index: number, nextValue: string) {
    if (!valueIsStringArray) return;
    onChange(value.map((item, i) => i === index ? nextValue : item));
  }

  return (
    <section className="bg-card border border-border rounded-xl overflow-hidden">
      <header className="px-5 py-3 border-b border-border bg-paper/40 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-serif font-bold text-ink truncate">{title}</h3>
          {subtitle && <p className="text-xs text-ink-light mt-0.5 truncate">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setRawMode(v => !v)}
          className="shrink-0 text-xs text-ink-light hover:text-accent transition-colors px-2 py-1 rounded border border-border hover:border-accent/40"
        >
          {rawMode ? '表单视图' : 'JSON 视图'}
        </button>
      </header>

      <div className="p-5">
        {rawMode ? (
          <textarea
            value={asString(value)}
            onChange={(e) => onChange(parseJsonOrKeep(e.target.value, value))}
            rows={10}
            className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink font-mono placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-y min-h-[180px]"
          />
        ) : valueIsObject ? (
          <div className="space-y-3">
            {Object.entries(value).length === 0 && (
              <p className="text-sm text-ink-light italic">AI 没有为该字段生成内容，可切换 JSON 视图直接添加。</p>
            )}
            {Object.entries(value).map(([key, fieldValue]) => {
              const sourceRefs = key === 'source_refs' && Array.isArray(fieldValue) ? extractSourceRefs({ source_refs: fieldValue }) : [];
              if (key === 'source_refs' && Array.isArray(fieldValue)) {
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-ink-light mb-1.5">原文依据</label>
                    {sourceRefs.length === 0 ? (
                      <p className="text-xs text-ink-light italic">无</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {sourceRefs.map((ref, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onOpenSourceRef?.(ref.chapter_id || 0, ref.start_offset || 0, ref.end_offset || 0)}
                            className="text-xs px-2.5 py-1 rounded border border-border bg-paper hover:bg-accent/10 hover:border-accent/40 hover:text-accent transition-colors"
                          >
                            查看依据 · {ref.chapter_title || `章节 ${ref.chapter_id}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (typeof fieldValue === 'string') {
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-ink-light mb-1.5">{key}</label>
                    <textarea
                      value={fieldValue}
                      onChange={(e) => updateObjectField(key, e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-y"
                    />
                  </div>
                );
              }
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-ink-light mb-1.5">{key}</label>
                  <textarea
                    value={asString(fieldValue)}
                    onChange={(e) => onChange({ ...value, [key]: parseJsonOrKeep(e.target.value, fieldValue) })}
                    rows={3}
                    className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-y"
                  />
                </div>
              );
            })}
          </div>
        ) : valueIsObjectArray ? (
          <div className="space-y-3">
            {value.length === 0 && (
              <p className="text-sm text-ink-light italic">AI 没有为该字段生成内容。</p>
            )}
            {value.map((item, index) => {
              const sourceRefs = extractSourceRefs(item);
              return (
                <div key={index} className="border border-border rounded-lg p-3 space-y-2 bg-paper/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-light">#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeArrayItem(index)}
                      className="text-xs text-error hover:text-error/80 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                  {Object.entries(item).map(([key, fieldValue]) => {
                    if (key === 'source_refs') return null;
                    if (typeof fieldValue === 'string') {
                      return (
                        <div key={key}>
                          <label className="block text-xs text-ink-light mb-1">{key}</label>
                          <textarea
                            value={fieldValue}
                            onChange={(e) => updateArrayItem(index, key, e.target.value)}
                            rows={1}
                            className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-sm text-ink focus:outline-none focus:border-accent transition-colors resize-y"
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <label className="block text-xs text-ink-light mb-1">{key}</label>
                        <textarea
                          value={asString(fieldValue)}
                          onChange={(e) => {
                            const next = value.map((it, i) => i === index ? { ...it, [key]: parseJsonOrKeep(e.target.value, fieldValue) } : it);
                            onChange(next);
                          }}
                          rows={2}
                          className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-sm text-ink font-mono focus:outline-none focus:border-accent transition-colors resize-y"
                        />
                      </div>
                    );
                  })}
                  {sourceRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {sourceRefs.map((ref, idx) => (
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
                  )}
                </div>
              );
            })}
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
            {value.length === 0 && (
              <p className="text-sm text-ink-light italic">AI 没有为该字段生成内容。</p>
            )}
            {value.map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateStringArrayItem(index, e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-paper border border-border rounded text-sm text-ink focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => removeArrayItem(index)}
                  className="text-xs text-error hover:text-error/80 transition-colors px-2"
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
          <textarea
            value={asString(value)}
            onChange={(e) => onChange(parseJsonOrKeep(e.target.value, value))}
            rows={4}
            className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink font-mono focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors resize-y"
          />
        )}
      </div>
    </section>
  );
}
