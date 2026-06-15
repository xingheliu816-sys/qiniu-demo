'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import { sortedActiveDrafts, getDisplayCode, getDisplayName } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';
import PageError from '@/components/PageError';

function showToast(message: string, type: 'success' | 'error') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-medium z-50 shadow-lg ${type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export default function YamlDraftsPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const initialNovelId = Number(params.id) || undefined;

  const [novelTitle, setNovelTitle] = useState('');
  const [drafts, setDrafts] = useState<api.YamlDraftItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<unknown>(null);

  // Selected novel + chapters
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(initialNovelId || null);
  const [selectedNovelName, setSelectedNovelName] = useState('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([]);
  const [selectedChapterNames, setSelectedChapterNames] = useState<string>('');

  // Selected schema
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('default');
  const [selectedSchemaName, setSelectedSchemaName] = useState('系统默认 Schema');
  const [useSchema, setUseSchema] = useState(true);

  // Generate state
  const [generating, setGenerating] = useState(false);

  // Modals
  const [novelModalOpen, setNovelModalOpen] = useState(false);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);

  // Novel modal data
  const [novels, setNovels] = useState<api.NovelItem[]>([]);
  const [modalChapters, setModalChapters] = useState<api.ChapterItem[]>([]);
  const [modalNovelId, setModalNovelId] = useState<number | null>(null);
  const [modalChapterIds, setModalChapterIds] = useState<Set<number>>(new Set());
  const [modalNovelLoading, setModalNovelLoading] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Schema modal data
  const [schemas, setSchemas] = useState<api.SchemaItem[]>([]);
  const [modalSchemaId, setModalSchemaId] = useState<string>('default');
  const [modalUseSchema, setModalUseSchema] = useState(true);

  // Multi-select delete
  const [editMode, setEditMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set());
  const [deletingDrafts, setDeletingDrafts] = useState(false);

  // Edit draft name dialog
  const [editNameTarget, setEditNameTarget] = useState<api.YamlDraftItem | null>(null);
  const [editDraftName, setEditDraftName] = useState('');

  // View draft detail
  const [selectedDraft, setSelectedDraft] = useState<api.YamlDraftItem | null>(null);
  const [editingYaml, setEditingYaml] = useState('');

  const loadAll = useCallback(async () => {
    if (!username) return;
    setPageLoading(true);
    setPageError(null);
    try {
      // Load novels list
      const n = await api.getNovels();
      if (n.success) setNovels(n.novels || []);

      // Load schemas
      const s = await api.getSchemas();
      if (s.success) setSchemas([...(s.system_schemas || []), ...(s.user_schemas || [])]);

      // If novel preselected, load its drafts
      if (selectedNovelId) {
        const detail = await api.getNovel(selectedNovelId);
        if (detail.success && detail.novel) {
          setNovelTitle(detail.novel.title);
          setSelectedNovelName(detail.novel.title);
        }
        const d = await api.getYamlDrafts(selectedNovelId);
        if (d.success) setDrafts(d.drafts || []);
      }
    } catch (err) {
      setPageError(err);
    } finally {
      setPageLoading(false);
    }
  }, [username, selectedNovelId]);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  useEffect(() => {
    const timer = window.setTimeout(loadAll, 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  // --- Novel Modal ---
  async function openNovelModal() {
    setNovelModalOpen(true);
    setModalChapterIds(new Set());
    setModalNovelId(null);
    setModalChapters([]);
  }

  async function selectModalNovel(novelId: number) {
    setModalNovelId(novelId);
    setModalNovelLoading(true);
    try {
      const chList = await api.getChapters(novelId);
      setModalChapters(chList.chapters || []);
      setModalChapterIds(new Set());
    } catch { setModalChapters([]); } finally { setModalNovelLoading(false); }
  }

  function toggleModalChapter(chId: number) {
    setModalChapterIds(prev => {
      const next = new Set(prev);
      next.has(chId) ? next.delete(chId) : next.add(chId);
      return next;
    });
  }

  // 全选/取消全选已提炼章节
  const extractedChapterIds = modalChapters.filter(c => c.extractionStatus === 'extracted').map(c => c.id);
  const modalSelectedExtractedCount = extractedChapterIds.filter(id => modalChapterIds.has(id)).length;
  const isAllExtractedSelected = extractedChapterIds.length > 0 && modalSelectedExtractedCount === extractedChapterIds.length;
  const isIndeterminate = modalSelectedExtractedCount > 0 && !isAllExtractedSelected;

  function toggleSelectAllExtracted() {
    if (isAllExtractedSelected) {
      setModalChapterIds(new Set());
    } else {
      setModalChapterIds(new Set(extractedChapterIds));
    }
  }

  function selectAllExtracted() {
    setModalChapterIds(new Set(extractedChapterIds));
  }

  // 同步"全选"处复选框的 indeterminate 状态
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  function confirmNovelSelection() {
    if (!modalNovelId) { showToast('请先选择一本小说。', 'error'); return; }
    const selected = modalChapters.filter(c => modalChapterIds.has(c.id) && c.extractionStatus === 'extracted');
    if (selected.length === 0) { showToast('请至少选择一个已提炼章节。', 'error'); return; }
    const novel = novels.find(n => n.id === modalNovelId);
    setSelectedNovelId(modalNovelId);
    setSelectedNovelName(novel?.title || '');
    setNovelTitle(novel?.title || '');
    setSelectedChapterIds(selected.map(c => c.id));
    setSelectedChapterNames(`${selected.length} 个已提炼章节`);
    setNovelModalOpen(false);
    // Reload drafts for this novel
    api.getYamlDrafts(modalNovelId).then(d => { if (d.success) setDrafts(d.drafts || []); }).catch(() => {});
  }

  // --- Schema Modal ---
  function openSchemaModal() {
    setModalSchemaId(selectedSchemaId);
    setModalUseSchema(useSchema);
    setSchemaModalOpen(true);
  }

  function confirmSchemaSelection() {
    setSelectedSchemaId(modalSchemaId);
    setUseSchema(modalUseSchema);
    if (!modalUseSchema) {
      setSelectedSchemaName('不使用 Schema');
    } else if (modalSchemaId === 'default') {
      setSelectedSchemaName('系统默认 Schema');
    } else {
      const s = schemas.find(s => String(s.id) === modalSchemaId);
      setSelectedSchemaName(s?.name || '系统默认 Schema');
    }
    setSchemaModalOpen(false);
  }

  // --- Generate ---
  const canGenerate = selectedNovelId && selectedChapterIds.length > 0 && !generating;

  async function handleGenerate() {
    if (!canGenerate || !selectedNovelId) return;
    setGenerating(true);
    try {
      const res = await api.generateYaml(
        selectedNovelId,
        useSchema ? selectedSchemaId : null,
        useSchema,
      );
      if (res.success) {
        const d = await api.getYamlDrafts(selectedNovelId);
        if (d.success) {
          const sorted = sortedActiveDrafts(d.drafts || []);
          const newDraft = sorted.find(dr => dr.id === res.draft?.id);
          if (newDraft) {
            showToast(`YAML 剧本草稿 ${getDisplayName(newDraft, sorted)} 生成完成`, 'success');
          } else {
            showToast('YAML 剧本草稿生成完成', 'success');
          }
          setDrafts(d.drafts || []);
        } else {
          showToast('YAML 剧本草稿生成完成', 'success');
        }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!canGenerate || !selectedNovelId) return;
    if (!window.confirm('重新生成会创建新版本，不覆盖已有草稿。是否继续？')) return;
    setGenerating(true);
    try {
      const res = await api.regenerateYaml(
        selectedNovelId,
        useSchema ? selectedSchemaId : null,
        useSchema,
      );
      if (res.success) {
        const d = await api.getYamlDrafts(selectedNovelId);
        if (d.success) {
          const sorted = sortedActiveDrafts(d.drafts || []);
          const newDraft = sorted.find(dr => dr.id === res.draft?.id);
          if (newDraft) {
            showToast(`YAML 剧本草稿 ${getDisplayName(newDraft, sorted)} 生成完成`, 'success');
          } else {
            showToast('YAML 剧本草稿生成完成', 'success');
          }
          setDrafts(d.drafts || []);
        } else {
          showToast('YAML 剧本草稿生成完成', 'success');
        }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重新生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  }

  // --- Draft detail ---
  function openDraft(draft: api.YamlDraftItem) {
    setSelectedDraft(draft);
    setEditingYaml(draft.user_edited_content || draft.yaml_content || '');
  }

  async function handleConfirm(draftId: number) {
    try {
      const res = await api.confirmYamlDraft(draftId);
      if (res.success) {
        const target = drafts.find(d => d.id === draftId);
        const sorted = sortedActiveDrafts(drafts);
        const name = target ? getDisplayName(target, sorted) : 'YAML 剧本';
        showToast(`${name} 已确认为最终 YAML 剧本`, 'success');
        await loadAll();
      }
    } catch { showToast('操作失败', 'error'); }
  }

  async function handleExportDraft(draftId: number) {
    try {
      const res = await api.exportFinalYaml(draftId, 'yaml');
      if (res.success) {
        const target = drafts.find(d => d.id === draftId);
        const sorted = sortedActiveDrafts(drafts);
        const name = target ? getDisplayName(target, sorted) : 'YAML 剧本';
        showToast(`${name} 导出成功`, 'success');
        const dl = await api.downloadFinalYaml(draftId);
        const blob = await dl.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = res.data?.fileName || 'script.yaml'; a.click();
        URL.revokeObjectURL(url);
      } else {
        showToast(res.message || '导出失败', 'error');
      }
    } catch { showToast('导出失败，请重试。', 'error'); }
  }

  function openEditNameDialog(e: React.MouseEvent, draft: api.YamlDraftItem) {
    e.stopPropagation();
    setEditNameTarget(draft);
    setEditDraftName(draft.draft_name || 'AI 生成 YAML');
  }

  async function handleSaveDraftName() {
    if (!editNameTarget) return;
    const trimmed = editDraftName.trim();
    if (!trimmed) { showToast('请输入 YAML 文件名称。', 'error'); return; }
    if (trimmed.length > 50) { showToast('YAML 文件名称不能超过 50 个字符。', 'error'); return; }
    try {
      const res = await api.updateYamlDraftName(editNameTarget.id, trimmed);
      if (res.success) {
        setDrafts(prev => prev.map(d => d.id === editNameTarget.id ? { ...d, draft_name: trimmed } : d));
        showToast('名称已更新', 'success');
      } else {
        showToast(res.message || '修改失败', 'error');
      }
    } catch { showToast('修改失败', 'error'); }
    setEditNameTarget(null);
  }

  async function handleDeleteDraft(draftId: number) {
    if (!window.confirm('确定要删除该 YAML 剧本版本吗？该操作不可撤销。')) return;
    try { await api.deleteYamlDraft(draftId); showToast('已删除', 'success'); await loadAll(); setSelectedDraft(null); } catch { showToast('删除失败', 'error'); }
  }

  function toggleEditMode() {
    setEditMode(!editMode);
    setSelectedDraftIds(new Set());
  }

  function toggleDraftSelect(draftId: number) {
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      next.has(draftId) ? next.delete(draftId) : next.add(draftId);
      return next;
    });
  }

  async function handleBatchDelete() {
    if (selectedDraftIds.size === 0) return;
    const hasConfirmed = Array.from(selectedDraftIds).some(id => {
      const d = drafts.find(dr => dr.id === id);
      return d?.status === 'confirmed';
    });
    const msg = hasConfirmed
      ? `所选版本中包含已确认最终 YAML 剧本，删除后将无法继续导出该版本。确定要删除选中的 ${selectedDraftIds.size} 个 YAML 剧本版本吗？该操作不可撤销。`
      : `确定要删除选中的 ${selectedDraftIds.size} 个 YAML 剧本版本吗？该操作不可撤销。`;
    if (!window.confirm(msg)) return;

    setDeletingDrafts(true);
    try {
      const res = await api.batchDeleteYamlDrafts(Array.from(selectedDraftIds));
      if (res.success) {
        showToast(`已删除选中的 YAML 剧本版本。`, 'success');
        setEditMode(false);
        setSelectedDraftIds(new Set());
        await loadAll();
      } else {
        showToast(res.message || '删除失败，请重试。', 'error');
      }
    } catch { showToast('删除失败，请重试。', 'error'); }
    finally { setDeletingDrafts(false); }
  }

  const statusLabel: Record<string, { label: string; cls: string }> = {
    generated: { label: '已生成', cls: 'text-success' },
    validation_failed: { label: '校验失败', cls: 'text-warning' },
    repair_failed: { label: '修复失败', cls: 'text-error' },
    failed: { label: '生成失败', cls: 'text-error' },
    editing: { label: '编辑中', cls: 'text-accent' },
    confirmed: { label: '已确认', cls: 'text-success' },
    deleted: { label: '已删除', cls: 'text-ink-light/50' },
  };

  if (isLoading || pageLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (pageError) return <PageError error={pageError} onRetry={loadAll} />;
  if (!username) return null;

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <div className="fixed right-3 top-3 z-40"><BackButton /></div>
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-xl font-serif font-bold text-ink">YAML 剧本</h2>
          <p className="text-sm text-ink-light mt-1">选择小说和 Schema，根据提炼结果生成 YAML 剧本草稿</p>
        </div>

        {/* Generate area */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink">生成 YAML 剧本</h3>

          {/* Selected info row */}
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <button onClick={openNovelModal}
              className="px-3 py-2 bg-paper border border-border rounded-lg text-ink-light hover:text-accent hover:border-accent/30 transition-colors">
              {selectedNovelId ? `小说：${selectedNovelName}` : '选择小说'}
            </button>
            {selectedNovelId && (
              <span className="text-xs text-ink-light">· {selectedChapterNames}</span>
            )}
            <button onClick={openSchemaModal}
              className="px-3 py-2 bg-paper border border-border rounded-lg text-ink-light hover:text-accent hover:border-accent/30 transition-colors">
              Schema：{selectedSchemaName}
            </button>
          </div>

          {/* Generate button */}
          <div className="flex items-center gap-3">
            {drafts.length === 0 ? (
              <button onClick={handleGenerate} disabled={!canGenerate || generating}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                {generating ? '生成中...' : '生成 YAML 剧本'}
              </button>
            ) : (
              <button onClick={handleRegenerate} disabled={!canGenerate || generating}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                {generating ? '生成中...' : '重新生成 YAML 剧本（新版本）'}
              </button>
            )}
            {!canGenerate && !generating && (
              <span className="text-xs text-ink-light/70">{!selectedNovelId ? '请先选择小说和已提炼章节。' : '请至少选择一个已提炼章节。'}</span>
            )}
          </div>
          {generating && <p className="text-sm text-ink-light animate-pulse">正在根据小说提炼结果和 YAML Schema 生成 YAML 剧本草稿，请稍候...</p>}
        </div>

        {/* Draft list */}
        {drafts.filter(d => d.status !== 'deleted').length === 0 && !generating && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm text-ink-light">{selectedNovelId ? '暂无 YAML 剧本草稿，请先生成。' : '请先选择一本小说。'}</p>
          </div>
        )}
        {drafts.filter(d => d.status !== 'deleted').length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-paper/40 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">版本列表</h3>
              <div className="flex items-center gap-2">
                {editMode && (
                  <>
                    <span className="text-xs text-ink-light">已选择 {selectedDraftIds.size} 个</span>
                    <button onClick={handleBatchDelete}
                      disabled={selectedDraftIds.size === 0 || deletingDrafts}
                      className="text-xs px-2 py-1 rounded border border-error text-error hover:bg-error/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {deletingDrafts ? '删除中...' : '删除'}
                    </button>
                  </>
                )}
                <button onClick={toggleEditMode}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${editMode ? 'bg-accent text-white border-accent' : 'border-border text-ink-light hover:border-accent/30'}`}>
                  {editMode ? '取消' : '批量管理'}
                </button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {(function() {
                const sorted = sortedActiveDrafts(drafts);
                return sorted.map(draft => {
                const st = statusLabel[draft.status] || { label: draft.status, cls: 'text-ink-light' };
                const isSelected = selectedDraftIds.has(draft.id);
                const displayCode = getDisplayCode(draft, sorted);
                const draftDisplayName = draft.draft_name || 'AI 生成 YAML';
                return (
                  <div key={draft.id} className={`px-5 py-4 flex items-center justify-between transition-colors ${isSelected && editMode ? 'bg-accent/5' : 'hover:bg-paper/30 cursor-pointer'}`}
                    onClick={editMode ? () => toggleDraftSelect(draft.id) : () => openDraft(draft)}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {editMode && (
                        <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleDraftSelect(draft.id); }}
                          className="w-4 h-4 accent-accent shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-ink">{displayCode} · {draftDisplayName}</span>
                          <span className={`text-xs ${st.cls}`}>{st.label}</span>
                        </div>
                        <div className="text-xs text-ink-light mt-1">Schema: {draft.schema_name_snapshot} · {draft.created_at?.substring(0, 16)}
                          {draft.validation_errors && <span className="ml-2 text-warning">校验有问题</span>}</div>
                      </div>
                    </div>
                    {!editMode && (
                    <div className="flex items-center gap-2 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); openEditNameDialog(e, draft); }}
                        className="text-xs text-ink-light hover:text-ink transition-colors">编辑</button>
                      {draft.status !== 'confirmed' && <button onClick={(e) => { e.stopPropagation(); handleConfirm(draft.id); }} className="text-xs text-success hover:text-success/80">确认</button>}
                      {draft.status === 'confirmed' && <button onClick={(e) => { e.stopPropagation(); handleExportDraft(draft.id); }} className="text-xs text-accent hover:text-accent-hover">导出</button>}
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }} className="text-xs text-error hover:text-error/80">删除</button>
                    </div>
                    )}
                  </div>
                );
              }); })()}
            </div>
          </div>
        )}

        {/* === Novel Selection Modal === */}
        {novelModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setNovelModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl p-0 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-ink">选择小说和章节</h3>
                <button onClick={() => setNovelModalOpen(false)} className="text-ink-light hover:text-ink text-lg leading-none">&times;</button>
              </div>

              <div className="flex-1 flex min-h-0">
                {/* Novel list */}
                <div className="w-56 border-r border-border overflow-y-auto shrink-0">
                  {novels.map(novel => {
                    const extCount = novel.chapter_count;  // Would need real count, use what we have
                    return (
                      <button key={novel.id}
                        onClick={() => selectModalNovel(novel.id)}
                        className={`w-full text-left px-4 py-3 text-sm border-b border-border/50 transition-colors hover:bg-paper/50 ${modalNovelId === novel.id ? 'bg-accent/5 border-l-2 border-l-accent' : ''}`}>
                        <div className="font-medium text-ink truncate">{novel.title || '未命名'}</div>
                        <div className="text-xs text-ink-light mt-0.5">{novel.chapter_count} 章</div>
                      </button>
                    );
                  })}
                </div>

                {/* Chapter list */}
                <div className="flex-1 overflow-y-auto p-4">
                  {!modalNovelId && <p className="text-sm text-ink-light text-center py-12">请从左侧选择一本小说</p>}
                  {modalNovelLoading && <p className="text-sm text-ink-light text-center py-12">加载章节中...</p>}

                  {modalNovelId && !modalNovelLoading && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-ink">章节列表</span>
                        <button onClick={selectAllExtracted}
                          className="text-xs text-accent hover:text-accent-hover transition-colors">
                          使用全部已提炼章节
                        </button>
                      </div>
                      {/* 全选已提炼章节 */}
                      {extractedChapterIds.length > 0 && (
                        <label className="flex items-center gap-3 px-3 py-2 mb-2 border border-border rounded-lg cursor-pointer hover:bg-paper/30 transition-colors">
                          <input ref={selectAllCheckboxRef} type="checkbox"
                            checked={isAllExtractedSelected}
                            onChange={toggleSelectAllExtracted}
                            className="w-4 h-4 accent-accent shrink-0" />
                          <span className="text-sm text-ink font-medium">
                            {isAllExtractedSelected ? '取消全选' : '全选已提炼章节'}
                          </span>
                          <span className="text-xs text-ink-light ml-auto">
                            {extractedChapterIds.length} 个可提炼
                          </span>
                        </label>
                      )}
                      <div className="space-y-1">
                        {modalChapters.map(ch => {
                          const isExtracted = ch.extractionStatus === 'extracted';
                          return (
                            <label key={ch.id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isExtracted ? 'cursor-pointer hover:bg-paper/50' : 'opacity-50 cursor-not-allowed'}`}>
                              <input type="checkbox"
                                checked={modalChapterIds.has(ch.id)}
                                onChange={() => toggleModalChapter(ch.id)}
                                disabled={!isExtracted}
                                className="w-4 h-4 accent-accent shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-ink">{ch.title}</span>
                                <span className="ml-2 text-xs text-ink-light">{ch.word_count} 字</span>
                              </div>
                              <span className={`text-xs shrink-0 ${isExtracted ? 'text-success' : 'text-ink-light/50'}`}>
                                {isExtracted ? '已提炼' : '未提炼'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {modalChapters.length === 0 && <p className="text-sm text-ink-light text-center py-8">暂无章节</p>}
                      <div className="mt-3 text-xs text-ink-light/70">
                        已选择 {modalChapterIds.size} 个已提炼章节
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
                <button onClick={() => setNovelModalOpen(false)} className="px-4 py-2 text-sm text-ink-light border border-border rounded-lg">取消</button>
                <button onClick={confirmNovelSelection} className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg">确认选择</button>
              </div>
            </div>
          </div>
        )}

        {/* === Edit YAML Name Dialog === */}
        {editNameTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditNameTarget(null)}>
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-ink">编辑 YAML 文件信息</h3>
                <button onClick={() => setEditNameTarget(null)} className="text-ink-light hover:text-ink text-lg leading-none">&times;</button>
              </div>

              {/* Editable name */}
              <div>
                <label className="block text-xs font-medium text-ink-light mb-1">YAML 文件名称</label>
                <input value={editDraftName} onChange={(e) => setEditDraftName(e.target.value)}
                  className="w-full px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink focus:outline-none focus:border-accent"
                  maxLength={50} autoFocus />
              </div>

              {/* Read-only info */}
              <div className="bg-paper/50 rounded-lg p-3 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-ink-light">展示编号</span><span className="text-ink">{getDisplayCode(editNameTarget, sortedActiveDrafts(drafts))}</span></div>
                <div className="flex justify-between"><span className="text-ink-light">内部版本号</span><span className="text-ink">v{editNameTarget.version}</span></div>
                <div className="flex justify-between"><span className="text-ink-light">生成类型</span><span className="text-ink">{editNameTarget.version_type === 'ai_generated' ? 'AI 生成' : editNameTarget.version_type === 'ai_repair' ? 'AI 修复' : editNameTarget.version_type}</span></div>
                <div className="flex justify-between"><span className="text-ink-light">状态</span><span className="text-ink">{statusLabel[editNameTarget.status]?.label || editNameTarget.status}</span></div>
                <div className="flex justify-between"><span className="text-ink-light">Schema</span><span className="text-ink">{editNameTarget.schema_name_snapshot}</span></div>
                <div className="flex justify-between"><span className="text-ink-light">创建时间</span><span className="text-ink">{editNameTarget.created_at?.substring(0, 16)}</span></div>
                <div className="flex justify-between"><span className="text-ink-light">已确认</span><span className="text-ink">{editNameTarget.status === 'confirmed' ? '是' : '否'}</span></div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditNameTarget(null)} className="px-4 py-2 text-sm text-ink-light border border-border rounded-lg">取消</button>
                <button onClick={handleSaveDraftName} className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg">保存修改</button>
              </div>
            </div>
          </div>
        )}

        {/* === Schema Selection Modal === */}
        {schemaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSchemaModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-serif font-bold text-ink">选择 YAML Schema</h3>
                <button onClick={() => setSchemaModalOpen(false)} className="text-ink-light hover:text-ink text-lg leading-none">&times;</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                {/* System default */}
                <div>
                  <h4 className="text-xs font-medium text-ink-light mb-2">系统默认 Schema</h4>
                  {schemas.filter(s => s.is_system).map(s => (
                    <div key={s.id}
                      onClick={() => { setModalSchemaId('default'); setModalUseSchema(true); }}
                      className={`border rounded-xl p-4 cursor-pointer transition-colors ${modalSchemaId === 'default' && modalUseSchema ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-ink">{s.name}</div>
                          <div className="text-xs text-ink-light mt-1">{s.description || '系统提供，适用于通用结构化剧本生成。'}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${modalSchemaId === 'default' && modalUseSchema ? 'bg-accent text-white' : 'border border-border text-ink-light'}`}>
                          {modalSchemaId === 'default' && modalUseSchema ? '已选择' : '选择'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* User schemas */}
                <div>
                  <h4 className="text-xs font-medium text-ink-light mb-2">我的 Schema</h4>
                  {schemas.filter(s => !s.is_system).length === 0 && (
                    <p className="text-sm text-ink-light py-4">当前未添加自定义 Schema。</p>
                  )}
                  {schemas.filter(s => !s.is_system).map(s => (
                    <div key={s.id}
                      onClick={() => { setModalSchemaId(String(s.id)); setModalUseSchema(true); }}
                      className={`border rounded-xl p-4 cursor-pointer transition-colors mb-2 ${modalSchemaId === String(s.id) && modalUseSchema ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-ink">{s.name}</div>
                          <div className="text-xs text-ink-light mt-1">{s.content_format?.toUpperCase()} · {s.updated_at?.substring(0, 10)}</div>
                          {s.description && <div className="text-xs text-ink-light mt-0.5">{s.description}</div>}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${modalSchemaId === String(s.id) && modalUseSchema ? 'bg-accent text-white' : 'border border-border text-ink-light'}`}>
                          {modalSchemaId === String(s.id) && modalUseSchema ? '已选择' : '选择'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* No schema option */}
                <div
                  onClick={() => { setModalUseSchema(false); setModalSchemaId('default'); }}
                  className={`border rounded-xl p-4 cursor-pointer transition-colors ${!modalUseSchema ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-ink">不使用 Schema</div>
                      <div className="text-xs text-ink-light mt-1">AI 自行设计 YAML 结构，仅做语法校验不做结构校验。</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${!modalUseSchema ? 'bg-accent text-white' : 'border border-border text-ink-light'}`}>
                      {!modalUseSchema ? '已选择' : '选择'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={() => setSchemaModalOpen(false)} className="px-4 py-2 text-sm text-ink-light border border-border rounded-lg">取消</button>
                <button onClick={confirmSchemaSelection} className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg">确认选择</button>
              </div>
            </div>
          </div>
        )}

        {/* Draft detail modal — read-only preview */}
        {selectedDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedDraft(null)}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-[90vw] max-w-4xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-serif font-bold text-ink">YAML 剧本 {getDisplayName(selectedDraft, sortedActiveDrafts(drafts))}</h3>
                <button onClick={() => setSelectedDraft(null)} className="text-ink-light hover:text-ink text-lg leading-none">&times;</button>
              </div>
              <div className="text-xs text-ink-light mb-2">
                Schema: {selectedDraft.schema_name_snapshot} · 状态: {statusLabel[selectedDraft.status]?.label || selectedDraft.status} · {selectedDraft.created_at?.substring(0, 16)}
                {selectedDraft.validation_errors && <span className="ml-2 text-warning">⚠ {selectedDraft.validation_errors}</span>}
              </div>
              <textarea
                value={editingYaml}
                readOnly
                className="flex-1 min-h-[300px] px-3 py-2 bg-paper border border-border rounded-lg text-sm text-ink/70 font-mono focus:outline-none resize-y cursor-default"
              />
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
                <button onClick={() => setSelectedDraft(null)} className="px-4 py-2 text-sm text-ink-light border border-border rounded-lg hover:text-ink transition-colors">关闭</button>
                <button onClick={() => router.push(`/yaml-editor?draft=${selectedDraft.id}`)}
                  className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors">
                  进入 YAML 编辑器
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
