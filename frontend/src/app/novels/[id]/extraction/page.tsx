'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import ExtractionCard from './ExtractionCard';
import SourceRefDrawer from './SourceRefDrawer';
import Sidebar from '@/components/Sidebar';
import PageError from '@/components/PageError';

const SECTION_ORDER: { key: keyof api.ExtractionResult; title: string; subtitle: string; module: string }[] = [
  { key: 'core_story', title: '核心故事', subtitle: '主人公、目标、阻碍、代价、不可逆变化', module: 'story' },
  { key: 'story_overview', title: '故事总览', subtitle: '对当前已导入章节的整体概括', module: 'story' },
  { key: 'chapter_summaries', title: '章节摘要', subtitle: '每章关键事件 / 角色 / 地点 / 戏剧功能', module: 'story' },
  { key: 'characters', title: '主要角色', subtitle: '身份、目标、深层需求、致命缺陷、人物弧光', module: 'character' },
  { key: 'relationships', title: '人物关系', subtitle: '关系类型、演变、关系里的债与秘密', module: 'character' },
  { key: 'locations', title: '地点列表', subtitle: '出现章节、戏剧作用、是否适合成为场景', module: 'scene' },
  { key: 'key_events', title: '关键事件', subtitle: '原因、结果、对主线影响', module: 'event' },
  { key: 'timeline', title: '时间线', subtitle: '叙述顺序与真实发生顺序', module: 'event' },
  { key: 'causal_chain', title: '因果链', subtitle: '故事推进的因果而非"然后然后"', module: 'event' },
  { key: 'dramatic_conflicts', title: '戏剧冲突', subtitle: '欲望相撞、选择损失、关系崩塌', module: 'conflict' },
  { key: 'high_value_scenes', title: '高价值场景', subtitle: '入场 / 在场 / 离场状态变化', module: 'scene' },
  { key: 'foreshadowing', title: '伏笔与回收', subtitle: '埋点章节、回收章节、是否保留', module: 'narrative' },
  { key: 'information_reveal', title: '信息揭示节奏', subtitle: '谁知道什么、何时揭示', module: 'narrative' },
  { key: 'inner_externalization', title: '内心外化建议', subtitle: '心理 → 可见的动作 / 物件 / 场面', module: 'craft' },
  { key: 'dialogue_candidates', title: '台词提炼', subtitle: '潜台词、表层话、真实意图', module: 'craft' },
  { key: 'visual_motifs', title: '视觉意象', subtitle: '可作为镜头语言的反复符号', module: 'craft' },
  { key: 'theme_questions', title: '主题问题', subtitle: '主题写成问题、不同角色的回答', module: 'craft' },
  { key: 'structure_outline', title: '结构骨架', subtitle: '引爆点 / 对抗 / 升级 / 崩塌 / 选择 / 余震', module: 'craft' },
  { key: 'cut_and_merge_suggestions', title: '取舍建议', subtitle: '砍 / 合并 / 压缩 / 必保留', module: 'adaptation' },
  { key: 'adaptation_risks', title: '改编风险', subtitle: '心理描写 / 旁白依赖 / 冲突不外显等', module: 'adaptation' },
  { key: 'adaptation_strategy', title: '改编策略', subtitle: '形式、风格、节奏、保留 / 强化建议', module: 'adaptation' },
  { key: 'narrative_perspective', title: '叙事视角', subtitle: '旁白 / 倒叙 / 多线 / 观众视角', module: 'narrative' },
  { key: 'world_rules', title: '世界观与规则', subtitle: '时代、规则、不能被打破的设定', module: 'world' },
  { key: 'factions', title: '阵营与势力', subtitle: '阵营目标、之间的合作 / 敌对', module: 'world' },
  { key: 'uncertain_items', title: '不确定项', subtitle: '需后续确认的人物关系、动机、伏笔等', module: 'uncertainty' },
];

const MODULE_OPTIONS = [
  { value: '', label: '全部模块' },
  { value: 'story', label: '故事核心' },
  { value: 'character', label: '角色与关系' },
  { value: 'event', label: '事件与时间线' },
  { value: 'scene', label: '场景' },
  { value: 'conflict', label: '冲突' },
  { value: 'narrative', label: '叙事技巧' },
  { value: 'craft', label: '写作手法' },
  { value: 'adaptation', label: '改编建议' },
  { value: 'world', label: '世界观' },
  { value: 'uncertainty', label: '不确定项' },
];

interface FilterOption {
  value: string;
  label: string;
}

function SearchBox({ filterOptions, filterValue, onFilterChange, searchFilter, onSearchChange }: {
  filterOptions: FilterOption[];
  filterValue: string;
  onFilterChange: (v: string) => void;
  searchFilter: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={filterValue}
        onChange={(e) => onFilterChange(e.target.value)}
        className="text-sm px-3 py-1.5 rounded-lg border border-border bg-paper text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
      >
        {filterOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={searchFilter}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="搜索分区名称..."
        className="text-sm px-3 py-1.5 rounded-lg border border-border bg-paper text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors w-48"
      />
    </div>
  );
}

function AddSectionDialog({ open, onClose, onConfirm }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-serif font-bold text-ink">添加自定义分区</h3>
        <p className="text-sm text-ink-light">输入分区名称（如：改编亮点）</p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="请输入分区名称"
          maxLength={50}
          className="w-full px-3.5 py-2.5 bg-paper border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onConfirm(name.trim()); setName(''); } }}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ink-light hover:text-ink border border-border rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => { if (name.trim()) { onConfirm(name.trim()); setName(''); } }}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

type Status = 'not_started' | 'extracting' | 'extracted' | 'editing' | 'confirmed' | 'failed' | string;

const statusLabel: Record<string, { label: string; tone: string }> = {
  not_started: { label: '未开始', tone: 'bg-ink-light/10 text-ink-light' },
  extracting: { label: '提炼中', tone: 'bg-warning/10 text-warning' },
  extracted: { label: '已提炼', tone: 'bg-success/10 text-success' },
  editing: { label: '编辑中', tone: 'bg-accent/10 text-accent' },
  confirmed: { label: '已确认', tone: 'bg-success/10 text-success' },
  failed: { label: '提炼失败', tone: 'bg-error/10 text-error' },
};

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

export default function NovelExtractionPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const novelId = Number(params.id);

  const [novelTitle, setNovelTitle] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<unknown>(null);

  const [chapters, setChapters] = useState<api.ChapterItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);

  const [status, setStatus] = useState<Status>('not_started');
  const [errorMessage, setErrorMessage] = useState('');
  const [aiResult, setAiResult] = useState<api.ExtractionResult | null>(null);
  const [userResult, setUserResult] = useState<api.ExtractionResult | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState<api.SourceRefResponse | null>(null);
  const [drawerError, setDrawerError] = useState('');

  const [moduleFilter, setModuleFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Chapter editing state
  const [chapterExtractionData, setChapterExtractionData] = useState<api.ExtractionResult | null>(null);
  const [customSections, setCustomSections] = useState<{ name: string; sectionKey: string }[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [chapterSaveStatus, setChapterSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  // beforeunload dirty check
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const loadAll = useCallback(async () => {
    if (!username || !novelId) return;
    setPageLoading(true);
    setPageError(null);
    try {
      const detail = await api.getNovel(novelId);
      if (!detail.success || !detail.novel) {
        setPageError({ code: 'NOT_FOUND', message: '小说项目不存在或无权访问' });
        return;
      }
      setNovelTitle(detail.novel.title);

      const chList = await api.getChapters(novelId);
      setChapters(chList.chapters || []);

      const ext = await api.getExtraction(novelId);
      if (ext.success) {
        setStatus(ext.status);
        setAiResult(ext.aiResult);
        setUserResult(ext.userResult);
        setErrorMessage(ext.errorMessage || '');
      } else {
        setPageError({ code: 'EXTRACTION_ERROR', message: ext.message || '获取提炼数据失败' });
      }
    } catch (err) {
      setPageError(err);
    } finally {
      setPageLoading(false);
    }
  }, [username, novelId]);

  useEffect(() => {
    const timer = window.setTimeout(loadAll, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  const editingResult = useMemo<api.ExtractionResult>(() => {
    return userResult || aiResult || {};
  }, [userResult, aiResult]);

  function patchSection<K extends keyof api.ExtractionResult>(key: K, next: api.ExtractionResult[K]) {
    setUserResult(prev => ({ ...(prev || aiResult || {}), [key]: next }));
    if (status === 'extracted' || status === 'confirmed') {
      setStatus('editing');
    }
  }

  // Chapter editing functions
  function patchChapterSection(key: string, value: unknown) {
    setChapterExtractionData(prev => ({ ...(prev || {}), [key]: value }));
    setIsDirty(true);
    setChapterSaveStatus('idle');
  }

  function deleteChapterSection(key: string) {
    if (!chapterExtractionData) return;
    const next = { ...chapterExtractionData };
    delete next[key];
    setChapterExtractionData(next);
    setIsDirty(true);
    setChapterSaveStatus('idle');
  }

  function handleAddSection(name: string) {
    const sectionKey = `custom_${Date.now()}_${name}`;
    setCustomSections(prev => [...prev, { name, sectionKey }]);
    setChapterExtractionData(prev => ({ ...(prev || {}), [sectionKey]: {} }));
    setAddSectionOpen(false);
    setIsDirty(true);
    setChapterSaveStatus('idle');
  }

  async function handleChapterSave() {
    if (!selectedChapterId || !chapterExtractionData) return;
    setChapterSaveStatus('saving');
    try {
      const res = await api.saveExtraction(novelId, chapterExtractionData);
      if (res.success) {
        setChapterSaveStatus('saved');
        setIsDirty(false);
        showToast('章节提炼已保存', 'success');
        await loadAll();
      } else {
        setChapterSaveStatus('error');
        showToast(res.message || '保存失败', 'error');
      }
    } catch {
      setChapterSaveStatus('error');
      showToast('保存失败', 'error');
    }
  }

  async function handleStart() {
    if (extracting) return;
    setExtracting(true);
    setStatus('extracting');
    setErrorMessage('');
    try {
      const data = await api.triggerExtraction(novelId);
      setStatus(data.status);
      setAiResult(data.aiResult);
      setUserResult(data.userResult);
      setErrorMessage(data.errorMessage || '');
      if (!data.success) {
        showToast(data.message || 'AI 提炼失败，请稍后重试。', 'error');
      } else {
        showToast('提炼完成', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI 提炼失败，请稍后重试。';
      setErrorMessage(msg);
      setStatus('failed');
      showToast(msg, 'error');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const payload = userResult || aiResult || {};
      const data = await api.saveExtraction(novelId, payload);
      if (data.success) {
        setStatus(data.status || 'confirmed');
        showToast('提炼结果已保存', 'success');
      } else {
        showToast(data.message || '保存失败', 'error');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenSourceRef(chapterId: number, startOffset: number, endOffset: number) {
    if (!chapterId) {
      showToast('该依据缺少章节信息', 'error');
      return;
    }
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError('');
    setDrawerData(null);
    try {
      const data = await api.getSourceRef(novelId, chapterId, startOffset, endOffset);
      if (data.success) {
        setDrawerData(data);
      } else {
        setDrawerError(data.message || '加载原文依据失败');
      }
    } catch (err: unknown) {
      setDrawerError(err instanceof Error ? err.message : '加载原文依据失败');
    } finally {
      setDrawerLoading(false);
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
    return <PageError error={pageError} onRetry={loadAll} />;
  }

  if (!username) return null;

  const tone = statusLabel[status] || statusLabel.not_started;
  const hasExtraction = status === 'extracted' || status === 'editing' || status === 'confirmed';

  function getSectionTitle(key: string): string {
    const found = SECTION_ORDER.find(s => s.key === key);
    if (found) return found.title;
    const custom = customSections.find(s => s.sectionKey === key);
    if (custom) return custom.name;
    return key;
  }

  function getSectionSubtitle(key: string): string | undefined {
    const found = SECTION_ORDER.find(s => s.key === key);
    return found?.subtitle;
  }

  // Filter sections by module and search
  const sectionsFilteredByModule = useMemo(() => {
    let sections = SECTION_ORDER;
    if (moduleFilter) {
      sections = sections.filter(s => s.module === moduleFilter);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      sections = sections.filter(s => s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q));
    }
    return sections;
  }, [moduleFilter, searchFilter]);

  // Custom sections
  const allDisplaySections = useMemo(() => {
    const standard = sectionsFilteredByModule.map(s => ({ key: s.key, isCustom: false as const }));
    const customs = customSections
      .filter(cs => {
        if (moduleFilter && moduleFilter !== '_custom') return false;
        if (searchFilter.trim() && !cs.name.toLowerCase().includes(searchFilter.trim().toLowerCase())) return false;
        return true;
      })
      .map(cs => ({ key: cs.sectionKey, isCustom: true as const }));
    return [...standard, ...customs];
  }, [sectionsFilteredByModule, customSections, moduleFilter, searchFilter]);

  const selectedChapter = selectedChapterId ? chapters.find(ch => ch.id === selectedChapterId) : null;

  return (
    <div className="flex-1 flex">
      <Sidebar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-serif font-bold text-ink truncate">{novelTitle || '未命名'}</h2>
            <p className="text-sm text-ink-light mt-1">
              {selectedChapter
                ? `第 ${selectedChapter.chapter_index} 章 · ${selectedChapter.title} · 章节提炼编辑`
                : '小说提炼 · 故事骨干 JSON 中间层'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`shrink-0 px-3 py-1 rounded text-xs font-medium ${tone.tone}`}>{tone.label}</span>
            {selectedChapter && (
              <button
                onClick={handleChapterSave}
                disabled={chapterSaveStatus === 'saving' || !isDirty}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {chapterSaveStatus === 'saving' ? '保存中...' : '保存章节提炼'}
              </button>
            )}
          </div>
        </div>

        {/* Chapter list */}
        {chapters.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-paper/40">
              <h3 className="text-sm font-bold text-ink">章节列表</h3>
            </div>
            <div className="divide-y divide-border max-h-60 overflow-y-auto">
              {chapters.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChapterId(selectedChapterId === ch.id ? null : ch.id)}
                  className={`w-full text-left px-5 py-3 flex items-center justify-between transition-colors hover:bg-paper/50 ${
                    selectedChapterId === ch.id ? 'bg-accent/5 border-l-2 border-accent' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <span className="text-sm text-ink-light mr-2">{ch.chapter_index}.</span>
                    <span className="text-sm text-ink">{ch.title}</span>
                  </div>
                  <span className={`text-xs shrink-0 ml-3 ${
                    ch.parse_status === 'parsed' ? 'text-success' : ch.parse_status === 'parse_failed' ? 'text-error' : 'text-ink-light'
                  }`}>
                    {ch.parse_status === 'parsed' ? '已提炼' : ch.parse_status === 'parse_failed' ? '提炼失败' : '未提炼'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'not_started' && !selectedChapterId && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <p className="text-sm text-ink-light">点击下方按钮，AI 将根据已保存章节提炼故事骨干。整个过程可能需要 30 – 90 秒。</p>
            <button
              onClick={handleStart}
              disabled={extracting}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {extracting ? '提炼中...' : '开始提炼'}
            </button>
          </div>
        )}

        {status === 'extracting' && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-ink-light animate-pulse">AI 正在提炼故事骨干，请稍候…</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-error mb-1">提炼失败</h3>
              <p className="text-sm text-error/80 whitespace-pre-wrap">{errorMessage || '未知错误'}</p>
            </div>
            <button
              onClick={handleStart}
              disabled={extracting}
              className="px-4 py-2 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 disabled:opacity-50 transition-colors"
            >
              {extracting ? '重试中...' : '重试提炼'}
            </button>
          </div>
        )}

        {hasExtraction && (
          <>
            {/* Global extraction area - shown when no chapter selected */}
            {!selectedChapterId && (
              <>
                <div className="bg-card border border-border rounded-xl px-5 py-4 text-sm text-ink-light flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    你可以编辑下方任意分区，编辑完成后点「保存最终结果」。
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? '保存中...' : '保存最终结果'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <SearchBox
                    filterOptions={MODULE_OPTIONS}
                    filterValue={moduleFilter}
                    onFilterChange={setModuleFilter}
                    searchFilter={searchFilter}
                    onSearchChange={setSearchFilter}
                  />
                  <div className="text-xs text-ink-light">
                    {sectionsFilteredByModule.length} / {SECTION_ORDER.length} 个分区
                  </div>
                </div>

                <div className="space-y-4">
                  {allDisplaySections.length === 0 && (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                      <p className="text-sm text-ink-light">当前筛选条件下没有分区。</p>
                    </div>
                  )}
                  {allDisplaySections.map(({ key }) => (
                    <ExtractionCard
                      key={key}
                      title={getSectionTitle(key)}
                      subtitle={getSectionSubtitle(key)}
                      value={editingResult[key] ?? (Array.isArray(aiResult?.[key]) ? [] : {})}
                      onChange={(next) => patchSection(key as keyof api.ExtractionResult, next as never)}
                      onOpenSourceRef={handleOpenSourceRef}
                    />
                  ))}
                </div>

                <div className="bg-card border border-border rounded-xl px-5 py-4 flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {saving ? '保存中...' : '保存最终结果'}
                  </button>
                </div>
              </>
            )}

            {/* Chapter editing view - shown when a chapter is selected */}
            {selectedChapterId && (
              <>
                <div className="bg-card border border-border rounded-xl px-5 py-4 text-sm text-ink-light flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    编辑该章节的提炼内容。修改后记得点击右上角「保存章节提炼」。
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAddSectionOpen(true)}
                      className="px-3 py-1.5 text-xs border border-border text-ink-light hover:text-accent hover:border-accent/30 rounded-lg transition-colors"
                    >
                      + 添加自定义分区
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <SearchBox
                    filterOptions={MODULE_OPTIONS}
                    filterValue={moduleFilter}
                    onFilterChange={setModuleFilter}
                    searchFilter={searchFilter}
                    onSearchChange={setSearchFilter}
                  />
                </div>

                <div className="space-y-4">
                  {allDisplaySections.length === 0 && (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                      <p className="text-sm text-ink-light">当前筛选条件下没有分区。</p>
                    </div>
                  )}
                  {allDisplaySections.map(({ key, isCustom }) => (
                    <ExtractionCard
                      key={key}
                      title={getSectionTitle(key)}
                      subtitle={getSectionSubtitle(key)}
                      value={chapterExtractionData?.[key] ?? (Array.isArray(aiResult?.[key]) ? [] : {})}
                      onChange={(next) => patchChapterSection(key, next)}
                      onOpenSourceRef={handleOpenSourceRef}
                      showDelete={isCustom}
                      onDelete={isCustom ? () => deleteChapterSection(key) : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!hasExtraction && status !== 'not_started' && status !== 'extracting' && status !== 'failed' && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-ink-light">当前暂无提炼内容。</p>
          </div>
        )}

        <div className="text-center">
          <button onClick={() => router.push('/novels')}
            className="text-sm text-ink-light hover:text-ink underline underline-offset-2 transition-colors">
            返回我的小说列表
          </button>
        </div>
      </main>

      <SourceRefDrawer
        open={drawerOpen}
        loading={drawerLoading}
        chapterTitle={drawerData?.chapter_title}
        excerpt={drawerData?.excerpt}
        startOffset={drawerData?.start_offset}
        endOffset={drawerData?.end_offset}
        fullLength={drawerData?.full_length}
        error={drawerError}
        onClose={() => setDrawerOpen(false)}
      />

      <AddSectionDialog
        open={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        onConfirm={handleAddSection}
      />
    </div>
  );
}
