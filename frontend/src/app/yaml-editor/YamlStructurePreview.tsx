'use client';

import { useState, useMemo } from 'react';
import * as jsyaml from 'js-yaml';

interface SectionDef {
  key: string;
  label: string;
  value: unknown;
  type: 'object' | 'array' | 'primitive' | 'null';
}

// ---- helpers ----

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function typeLabel(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function truncate(s: string, max = 120): string {
  if (!s) return s;
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function fieldDisplay(val: unknown): string {
  if (val === null || val === undefined) return '未填写';
  if (typeof val === 'boolean') return val ? '是' : '否';
  return truncate(String(val));
}

// ---- section key-field helpers ----

/** 从 characters 数组中收集所有 source_refs 做汇总 */
function collectSourceRefs(obj: Record<string, unknown>): { chapter_id: unknown; chapter_title: unknown; excerpt_preview?: unknown }[] {
  const refs: { chapter_id: unknown; chapter_title: unknown; excerpt_preview?: unknown }[] = [];
  function walk(v: unknown) {
    if (isRecord(v)) {
      if (v.source_refs && Array.isArray(v.source_refs)) {
        for (const r of v.source_refs) {
          if (isRecord(r)) refs.push({ chapter_id: r.chapter_id, chapter_title: r.chapter_title, excerpt_preview: r.excerpt_preview });
        }
      }
      for (const k of Object.keys(v)) walk(v[k]);
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item);
    }
  }
  walk(obj);
  return refs;
}

/** 按 chapter_id 去重 source_refs 汇总 */
function uniqueRefs(refs: ReturnType<typeof collectSourceRefs>) {
  const seen = new Set<number | string>();
  const out: typeof refs = [];
  for (const r of refs) {
    const id = r.chapter_id != null ? String(r.chapter_id) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

/** 查找 source_refs 在各模块中出现的次数 */
function refAppearanceCount(obj: Record<string, unknown>, targetChapterId: unknown): number {
  let count = 0;
  function walk(v: unknown) {
    if (isRecord(v)) {
      if (v.source_refs && Array.isArray(v.source_refs)) {
        for (const r of v.source_refs) {
          if (isRecord(r) && String(r.chapter_id) === String(targetChapterId)) count++;
        }
      }
      for (const k of Object.keys(v)) walk(v[k]);
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item);
    }
  }
  walk(obj);
  return count;
}

// ---- sub-components ----

function CollapsibleSection({ title, count, defaultOpen = false, children }: {
  title: string; count?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 bg-paper/40 hover:bg-paper/60 transition-colors text-left">
        <span className="text-sm font-medium text-ink">
          {title}
          {count !== undefined && <span className="ml-1.5 text-xs text-ink-light font-normal">{count} 项</span>}
        </span>
        <span className="text-xs text-ink-light">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-2">{children}</div>}
    </div>
  );
}

function FieldRow({ name, value, mono }: { name: string; value: unknown; mono?: boolean }) {
  const display = fieldDisplay(value);
  return (
    <div className="flex items-start gap-2 text-xs py-0.5">
      <span className="text-ink-light shrink-0">{name}：</span>
      <span className={`text-ink break-words min-w-0 ${mono ? 'font-mono text-[11px]' : ''}`}>{display}</span>
    </div>
  );
}

function MetadataSection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <CollapsibleSection title="基础信息 metadata" count={entries.length} defaultOpen>
      {entries.map(([k, v]) => (
        <FieldRow key={k} name={k} value={v} />
      ))}
    </CollapsibleSection>
  );
}

function CharacterCard({ char, idx }: { char: Record<string, unknown>; idx: number }) {
  const [open, setOpen] = useState(false);
  const name = char.name || char.character_name || `角色 ${idx + 1}`;
  const role = char.role_type ? ` · ${char.role_type}` : '';
  const keyFields = ['identity', 'story_function', 'surface_goal', 'deep_need', 'fatal_flaw'];
  const previewFields = keyFields.filter(k => char[k] !== undefined).slice(0, 3);

  const allFields = Object.entries(char);
  const extraCount = allFields.length - previewFields.length - 1; // minus name

  return (
    <div className="bg-white border border-border rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{String(name)}{role}</span>
        <button onClick={() => setOpen(!open)} className="text-[10px] text-accent hover:text-accent-hover">
          {open ? '收起' : `展开${extraCount > 0 ? ` (${extraCount} 字段)` : ''}`}
        </button>
      </div>
      {previewFields.map(k => (
        <FieldRow key={k} name={k} value={char[k]} />
      ))}
      {open && allFields.filter(([k]) => !['name', 'character_name', ...previewFields].includes(k)).map(([k, v]) => (
        <FieldRow key={k} name={k} value={k === 'arc' && isRecord(v) ? JSON.stringify(v) : v} />
      ))}
      {(char.source_refs as unknown[]) && isArray(char.source_refs) && (char.source_refs as unknown[]).length > 0 && (
        <div className="text-[10px] text-ink-light/70 mt-1">来源：{(char.source_refs as unknown[]).map((r: unknown) => isRecord(r) ? (r.chapter_title || `第 ${r.chapter_id} 章`) : '').filter(Boolean).join('、')}</div>
      )}
    </div>
  );
}

function CharactersSection({ data }: { data: unknown[] }) {
  if (!isArray(data) || data.length === 0) return null;
  const chars = data.filter(isRecord);
  if (chars.length === 0) { return <CollapsibleSection title="人物 characters"><p className="text-xs text-ink-light py-4 text-center">暂无人物数据</p></CollapsibleSection>; }
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? chars : chars.slice(0, 3);
  return (
    <CollapsibleSection title="人物 characters" count={chars.length} defaultOpen>
      <div className="space-y-2">
        {visible.map((c, i) => <CharacterCard key={i} char={c} idx={i} />)}
        {chars.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="text-xs text-accent hover:text-accent-hover w-full text-center py-1">
            {showAll ? '收起全部' : `展开全部 (${chars.length})`}
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
}

function RelationshipCard({ rel, idx }: { rel: Record<string, unknown>; idx: number }) {
  const from = rel.from || rel.from_character || rel.character_a || '';
  const to = rel.to || rel.to_character || rel.character_b || '';
  const type = rel.type || rel.relation_type || rel.relationship || '';
  const strength = rel.strength || rel.intensity || '';
  const desc = rel.description || rel.summary || rel.notes || '';
  return (
    <div className="bg-white border border-border rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-ink">{String(from)}</span>
        {type && <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">{String(type)}</span>}
        <span className="text-ink-light">→</span>
        <span className="text-sm font-medium text-ink">{String(to)}</span>
        {strength && <span className="text-[10px] text-ink-light">强度：{String(strength)}</span>}
      </div>
      {desc && <div className="text-xs text-ink-light">{truncate(String(desc), 120)}</div>}
      {(rel.source_refs as unknown[]) && isArray(rel.source_refs) && (rel.source_refs as unknown[]).length > 0 && (
        <div className="text-[10px] text-ink-light/70">
          来源：{(rel.source_refs as unknown[]).map((r: unknown) => isRecord(r) ? (r.chapter_title || `第 ${r.chapter_id} 章`) : '').filter(Boolean).join('、')}
        </div>
      )}
    </div>
  );
}

function RelationshipsSection({ data }: { data: unknown[] }) {
  if (!isArray(data) || data.length === 0) return null;
  const rels = data.filter(isRecord);
  if (rels.length === 0) { return <CollapsibleSection title="人物关系 relationships"><p className="text-xs text-ink-light py-4 text-center">暂无关系数据</p></CollapsibleSection>; }
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rels : rels.slice(0, 3);
  return (
    <CollapsibleSection title="人物关系 relationships" count={rels.length} defaultOpen>
      <div className="space-y-2">
        {visible.map((r, i) => <RelationshipCard key={i} rel={r} idx={i} />)}
        {rels.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="text-xs text-accent hover:text-accent-hover w-full text-center py-1">
            {showAll ? '收起全部' : `展开全部 (${rels.length})`}
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
}

function SceneCard({ scene, idx }: { scene: Record<string, unknown>; idx: number }) {
  const [open, setOpen] = useState(false);
  const id = scene.scene_id || scene.id || `S${String(idx + 1).padStart(3, '0')}`;
  const title = scene.title || scene.name || '';
  const fields = ['location', 'time', 'summary', 'conflict'];
  const previewFields = fields.filter(k => scene[k] !== undefined).slice(0, 3);

  return (
    <div className="bg-white border border-border rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{String(id)}{title ? ` · ${String(title)}` : ''}</span>
        <button onClick={() => setOpen(!open)} className="text-[10px] text-accent hover:text-accent-hover">{open ? '收起' : '展开'}</button>
      </div>
      {previewFields.map(k => (
        <FieldRow key={k} name={k} value={scene[k]} />
      ))}
      {open && (
        <>
          {Object.entries(scene).filter(([k]) => !['scene_id', 'id', 'title', 'name', ...previewFields].includes(k)).map(([k, v]) => (
            <FieldRow key={k} name={k} value={isRecord(v) || isArray(v) ? `${typeLabel(v)} · ${Array.isArray(v) ? v.length + ' 项' : Object.keys(v as object).length + ' 字段'}` : v} />
          ))}
        </>
      )}
      {/* inline counts */}
      <div className="flex gap-3 text-[10px] text-ink-light/70 flex-wrap">
        {scene.actions !== undefined && <span>动作：{isArray(scene.actions) ? scene.actions.length : 0} 条</span>}
        {scene.dialogue !== undefined && <span>对白：{isArray(scene.dialogue) ? scene.dialogue.length : 0} 条</span>}
        {scene.characters !== undefined && <span>人物：{isArray(scene.characters) ? scene.characters.length : 0}</span>}
        {scene.source_refs !== undefined && <span>来源：{isArray(scene.source_refs) ? scene.source_refs.length : 0} 条</span>}
      </div>
    </div>
  );
}

function ScenesSection({ data }: { data: unknown[] }) {
  if (!isArray(data) || data.length === 0) return null;
  const scenes = data.filter(isRecord);
  if (scenes.length === 0) { return <CollapsibleSection title="场景 scenes"><p className="text-xs text-ink-light py-4 text-center">暂无场景数据</p></CollapsibleSection>; }
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? scenes : scenes.slice(0, 3);
  return (
    <CollapsibleSection title="场景 scenes" count={scenes.length} defaultOpen>
      <div className="space-y-2">
        {visible.map((s, i) => <SceneCard key={i} scene={s} idx={i} />)}
        {scenes.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="text-xs text-accent hover:text-accent-hover w-full text-center py-1">
            {showAll ? '收起全部' : `展开全部 (${scenes.length})`}
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
}

function EpisodesSection({ data }: { data: unknown[] }) {
  if (!isArray(data) || data.length === 0) return null;
  const eps = data.filter(isRecord);
  if (eps.length === 0) return null;
  return (
    <CollapsibleSection title="剧集 episodes" count={eps.length}>
      <div className="space-y-2">
        {eps.map((ep, i) => {
          const title = ep.title || ep.name || '';
          const conflict = ep.core_conflict || ep.conflict || '';
          const sceneCount = ep.scenes && isArray(ep.scenes) ? ep.scenes.length : undefined;
          return (
            <div key={i} className="bg-white border border-border rounded-lg p-3 space-y-1">
              <div className="text-sm font-medium text-ink">第 {i + 1} 集{title ? `：${String(title)}` : ''}</div>
              {conflict && <FieldRow name="核心冲突" value={conflict} />}
              {sceneCount !== undefined && <div className="text-[10px] text-ink-light/70">包含场景：{sceneCount} 个</div>}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function SourceRefsSection({ data }: { data: Record<string, unknown> }) {
  const refs = uniqueRefs(collectSourceRefs(data));
  if (refs.length === 0) return null;
  return (
    <CollapsibleSection title="来源引用 source_refs" count={refs.length}>
      <div className="space-y-2">
        {refs.map((r, i) => {
          const title = r.chapter_title || `第 ${r.chapter_id} 章`;
          const count = refAppearanceCount(data, r.chapter_id);
          const excerpt = r.excerpt_preview ? truncate(String(r.excerpt_preview), 100) : '';
          return (
            <div key={i} className="bg-white border border-border rounded-lg p-3 space-y-1">
              <div className="text-sm font-medium text-ink">{String(title)}</div>
              <div className="text-[10px] text-ink-light/70">出现在 {count} 个字段中</div>
              {excerpt && <div className="text-xs text-ink-light mt-1 leading-relaxed">{excerpt}</div>}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

function DynamicFieldCard({ name, value }: { name: string; value: unknown }) {
  if (value === null || value === undefined) {
    return <FieldRow name={name} value={null} />;
  }
  if (isArray(value)) {
    const items = value;
    const [open, setOpen] = useState(false);
    return (
      <CollapsibleSection key={name} title={name} count={items.length} defaultOpen={items.length <= 3}>
        <div className="space-y-1">
          {items.slice(0, open ? undefined : 5).map((item, i) => (
            <div key={i} className="text-xs text-ink bg-paper rounded px-2 py-1">
              {isRecord(item)
                ? Object.entries(item).slice(0, 3).map(([k, v]) => <FieldRow key={k} name={k} value={v} />)
                : fieldDisplay(item)}
            </div>
          ))}
          {items.length > 5 && (
            <button onClick={() => setOpen(!open)} className="text-xs text-accent hover:text-accent-hover w-full text-center py-1">
              {open ? '收起全部' : `展开全部 (${items.length})`}
            </button>
          )}
        </div>
      </CollapsibleSection>
    );
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    return (
      <CollapsibleSection title={name} count={entries.length}>
        {entries.map(([k, v]) => <FieldRow key={k} name={k} value={v} />)}
      </CollapsibleSection>
    );
  }
  // primitive
  return (
    <div className="bg-white border border-border rounded-lg p-3">
      <FieldRow name={name} value={value} />
    </div>
  );
}

// ---- Main Component ----

interface YamlStructurePreviewProps {
  yamlText: string;
}

export default function YamlStructurePreview({ yamlText }: YamlStructurePreviewProps) {
  const parsed = useMemo(() => {
    try {
      const obj = jsyaml.load(yamlText);
      if (!isRecord(obj) && !isArray(obj)) return { error: 'YAML 不是对象或数组结构。', data: null };
      return { error: null, data: obj as Record<string, unknown> };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'YAML 解析失败', data: null };
    }
  }, [yamlText]);

  // error state
  if (parsed.error || !parsed.data) {
    return (
      <div className="p-4">
        <h3 className="text-sm font-bold text-ink mb-3">剧本结构预览</h3>
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-6 text-center">
          <p className="text-sm text-warning font-medium">当前 YAML 语法错误，暂无法生成结构预览。</p>
          <p className="text-xs text-ink-light mt-2">{parsed.error}</p>
        </div>
      </div>
    );
  }

  const data = parsed.data;
  const knownKeys = new Set(['metadata', 'characters', 'relationships', 'scenes', 'episodes', 'source_refs', 'generation_notes', 'validation_notes']);
  const sections: SectionDef[] = Object.entries(data).map(([k, v]) => {
    let type: SectionDef['type'] = 'primitive';
    if (v === null || v === undefined) type = 'null';
    else if (Array.isArray(v)) type = 'array';
    else if (typeof v === 'object') type = 'object';
    return { key: k, label: k, value: v, type };
  });

  // bucket sections
  const metadataSection = sections.find(s => s.key === 'metadata' && isRecord(s.value));
  const charsSection = sections.find(s => s.key === 'characters' && isArray(s.value));
  const relsSection = sections.find(s => s.key === 'relationships' && isArray(s.value));
  const scenesSection = sections.find(s => s.key === 'scenes' && isArray(s.value));
  const epsSection = sections.find(s => s.key === 'episodes' && isArray(s.value));
  const genNotes = sections.find(s => s.key === 'generation_notes' && isRecord(s.value));
  const valNotes = sections.find(s => s.key === 'validation_notes' && isRecord(s.value));

  const handledKeys = new Set(['metadata', 'characters', 'relationships', 'scenes', 'episodes', 'source_refs', 'generation_notes', 'validation_notes']);
  const dynamicSections = sections.filter(s => !handledKeys.has(s.key));

  // structure summary counts
  const summaryItems: { label: string; detail: string }[] = [];
  if (metadataSection) summaryItems.push({ label: 'metadata', detail: `${Object.keys(metadataSection.value as object).length} 个字段` });
  if (charsSection) summaryItems.push({ label: 'characters', detail: `${(charsSection.value as unknown[]).length} 个人物` });
  if (relsSection) summaryItems.push({ label: 'relationships', detail: `${(relsSection.value as unknown[]).length} 条关系` });
  if (scenesSection) summaryItems.push({ label: 'scenes', detail: `${(scenesSection.value as unknown[]).length} 个场景` });
  if (epsSection) summaryItems.push({ label: 'episodes', detail: `${(epsSection.value as unknown[]).length} 个剧集` });
  const refs = uniqueRefs(collectSourceRefs(data));
  if (refs.length > 0) summaryItems.push({ label: 'source_refs', detail: `${refs.length} 条来源` });
  if (genNotes) summaryItems.push({ label: 'generation_notes', detail: `${isRecord(genNotes.value) ? Object.keys(genNotes.value as object).length : 0} 项` });
  for (const ds of dynamicSections) {
    if (isArray(ds.value)) summaryItems.push({ label: ds.key, detail: `${ds.value.length} 项` });
    else if (isRecord(ds.value)) summaryItems.push({ label: ds.key, detail: `${Object.keys(ds.value as object).length} 个字段` });
    else summaryItems.push({ label: ds.key, detail: typeLabel(ds.value) });
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-bold text-ink">剧本结构预览</h3>

      {/* Structure overview */}
      <div className="bg-paper/40 border border-border rounded-xl p-4 space-y-1">
        <div className="text-xs font-medium text-ink-light mb-2">结构概览</div>
        {summaryItems.map((s, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-ink">{s.label}</span>
            <span className="text-ink-light">{s.detail}</span>
          </div>
        ))}
      </div>

      {/* metadata */}
      {metadataSection && <MetadataSection data={metadataSection.value as Record<string, unknown>} />}

      {/* characters */}
      {charsSection && <CharactersSection data={charsSection.value as unknown[]} />}

      {/* relationships */}
      {relsSection && <RelationshipsSection data={relsSection.value as unknown[]} />}

      {/* scenes */}
      {scenesSection && <ScenesSection data={scenesSection.value as unknown[]} />}

      {/* episodes */}
      {epsSection && <EpisodesSection data={epsSection.value as unknown[]} />}

      {/* source_refs summary */}
      {(charsSection || relsSection || scenesSection) && <SourceRefsSection data={data} />}

      {/* generation_notes */}
      {genNotes && isRecord(genNotes.value) && (
        <CollapsibleSection title="生成备注 generation_notes" count={Object.keys(genNotes.value as object).length}>
          {Object.entries(genNotes.value as object).map(([k, v]) => (
            <FieldRow key={k} name={k} value={Array.isArray(v) ? (v as unknown[]).join('；') : v} />
          ))}
        </CollapsibleSection>
      )}

      {/* validation_notes */}
      {valNotes && isRecord(valNotes.value) && (
        <CollapsibleSection title="校验备注 validation_notes" count={Object.keys(valNotes.value as object).length}>
          {Object.entries(valNotes.value as object).map(([k, v]) => (
            <FieldRow key={k} name={k} value={Array.isArray(v) ? (v as unknown[]).join('；') : v} />
          ))}
        </CollapsibleSection>
      )}

      {/* dynamic fields */}
      {dynamicSections.map(s => (
        <DynamicFieldCard key={s.key} name={s.key} value={s.value} />
      ))}

      {/* empty state */}
      {sections.length === 0 && (
        <div className="text-center py-12 text-sm text-ink-light">
          当前 YAML 暂无结构化内容。
        </div>
      )}
    </div>
  );
}
