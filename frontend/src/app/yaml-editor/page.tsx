'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import { sortedActiveDrafts, getDisplayCode, getDisplayName } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';
import YamlStructurePreview from './YamlStructurePreview';

function showToast(message: string, type: 'success' | 'error') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-sm font-medium z-50 shadow-lg ${type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), type === 'success' ? 2000 : 4000);
}

function YamlEditorInner() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams.get('draft');
  const initialDraftId = draftIdFromUrl ? Number(draftIdFromUrl) : null;

  // Entry state
  const [novels, setNovels] = useState<api.NovelItem[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<api.YamlDraftItem[]>([]);

  // Editor state
  const [editorDraft, setEditorDraft] = useState<api.YamlDraftItem | null>(null);
  const [allNovelDrafts, setAllNovelDrafts] = useState<api.YamlDraftItem[]>([]);
  const [yamlContent, setYamlContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [viewMode, setViewMode] = useState<'yaml' | 'cards' | 'dual'>('dual');
  const [validationStatus, setValidationStatus] = useState<{
    valid: boolean; yamlSyntaxValid: boolean; schemaValid: boolean | null;
    canConfirm: boolean; canExport: boolean;
    errors: { type: string; severity: string; title: string; line?: number; column?: number; fieldPath?: string; message: string; suggestion?: string; rawError?: string }[];
    warnings: { type: string; severity: string; title: string; line?: number; fieldPath?: string; message: string; suggestion?: string }[];
    checks: { name: string; status: string; message: string; warningCount?: number }[];
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationExpanded, setValidationExpanded] = useState(false);
  const [errorLine, setErrorLine] = useState<number | null>(null);

  // Auto-save timer
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedContent = useRef('');
  const yamlContentRef = useRef(yamlContent);
  yamlContentRef.current = yamlContent;

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  // Load novels list and editor draft
  useEffect(() => {
    if (!username) return;
    api.getNovels().then(d => { if (d.success) setNovels(d.novels || []); }).catch(() => {});
    if (initialDraftId) {
      loadDraft(initialDraftId);
    }
  }, [username]);

  async function loadDraft(draftId: number) {
    setPageLoading(true);
    try {
      const res = await api.getYamlDraft(draftId);
      if (res.success && res.draft) {
        setEditorDraft(res.draft);
        const content = res.draft.user_edited_content || res.draft.yaml_content || '';
        setYamlContent(content);
        setOriginalContent(res.draft.yaml_content || '');
        lastSavedContent.current = content;
        setSaveStatus('saved');
        // Load all drafts for same novel (to compute display code)
        api.getYamlDrafts(res.draft.novel_id).then(d => {
          if (d.success) setAllNovelDrafts(d.drafts || []);
        }).catch(() => {});
        // Load validation
        validateContent(content, res.draft);
      } else {
        showToast('草稿不存在或无权访问', 'error');
      }
    } catch { showToast('加载草稿失败', 'error'); } finally { setPageLoading(false); }
  }

  async function validateContent(content?: string, draft?: api.YamlDraftItem) {
    const d = draft || editorDraft;
    if (!d) return;
    try {
      const res = await api.validateYamlDraft(d.id);
      if (res.success && res.data) setValidationStatus(res.data as typeof validationStatus);
    } catch { /* ignore */ }
  }

  // Auto-save
  useEffect(() => {
    if (!editorDraft) return;
    autoSaveTimer.current = setInterval(async () => {
      const current = yamlContentRef.current;
      if (current !== lastSavedContent.current && editorDraft) {
        setSaveStatus('saving');
        try {
          const res = await api.autosaveYamlDraft(editorDraft.id, current);
          if (res.success) { lastSavedContent.current = current; setSaveStatus('saved'); }
          else setSaveStatus('error');
        } catch { setSaveStatus('error'); }
      }
    }, 5000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [editorDraft?.id]);

  // Unsaved changes warning
  useEffect(() => {
    if (!editorDraft) return;
    function beforeUnload(e: BeforeUnloadEvent) {
      if (yamlContentRef.current !== lastSavedContent.current) {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [editorDraft?.id]);

  // Entry: select novel → load drafts
  async function selectNovel(novelId: number) {
    setSelectedNovelId(novelId);
    try {
      const res = await api.getYamlDrafts(novelId);
      if (res.success) setDrafts(res.drafts || []);
    } catch { setDrafts([]); }
  }

  function enterEditor(draft: api.YamlDraftItem) {
    router.push(`/yaml-editor?draft=${draft.id}`);
  }

  // Editor actions
  async function handleManualSave() {
    if (!editorDraft) return;
    setSaveStatus('saving');
    try {
      const res = await api.saveYamlDraft(editorDraft.id, yamlContent);
      if (res.success) { lastSavedContent.current = yamlContent; setSaveStatus('saved'); showToast('已保存', 'success'); }
      else { setSaveStatus('error'); showToast('保存失败，请重试。', 'error'); }
    } catch { setSaveStatus('error'); showToast('保存失败，请重试。', 'error'); }
  }

  function jumpToErrorLine(line: number, column?: number) {
    // 卡片模式自动切到双栏以便看到编辑区
    if (viewMode === 'cards') setViewMode('dual');

    setErrorLine(line);
    setTimeout(() => {
      const ta = document.querySelector('.CodeEditor textarea') as HTMLTextAreaElement;
      if (!ta) return;
      const lines = ta.value.split('\n');
      if (line > lines.length) { showToast('错误行已不存在，请重新校验。', 'error'); return; }
      let pos = 0;
      for (let j = 0; j < Math.min(line - 1, lines.length); j++) pos += lines[j].length + 1;
      const col = Math.max(0, (column || 1) - 1);
      const target = Math.min(pos + col, ta.value.length);
      ta.focus();
      ta.setSelectionRange(target, target);
      // 滚动到目标行在可视区上 1/3 处
      const lineHeight = 22;
      const visibleLines = Math.floor(ta.clientHeight / lineHeight);
      ta.scrollTop = Math.max(0, (line - 1 - Math.floor(visibleLines / 3)) * lineHeight);
    }, 50);
  }

  // 重新校验时清除旧高亮
  function handleRevalidate() {
    if (!editorDraft || validating) return;
    setErrorLine(null);
    setValidating(true);
    validateContent(yamlContent).finally(() => setValidating(false));
  }

  async function handleAiRepair() {
    if (!editorDraft || repairing) return;
    setRepairing(true);
    try {
      const res = await api.aiRepairYaml(editorDraft.id);
      if (res.success) {
        showToast('AI 修复完成，已创建新版本', 'success');
        if (res.draftId) { router.push(`/yaml-editor?draft=${res.draftId}`); return; }
      } else {
        showToast(res.message || 'AI 修复失败，请查看错误信息并手动修改。', 'error');
      }
    } catch { showToast('AI 修复失败', 'error'); }
    finally { setRepairing(false); }
  }

  async function handleConfirm() {
    if (!editorDraft) return;
    if (validationStatus && !validationStatus.canConfirm) {
      showToast('当前 YAML 未通过校验，不能确认最终 YAML 剧本。', 'error');
      return;
    }
    try {
      const res = await api.confirmYamlDraft(editorDraft.id);
      if (res.success) {
        showToast(`${editorDc} · ${editorDn} 已确认为最终 YAML 剧本`, 'success');
        setEditorDraft(prev => prev ? { ...prev, status: 'confirmed' } : null);
      }
    } catch { showToast('确认失败', 'error'); }
  }

  async function handleExport(fmt: string) {
    if (!editorDraft) return;
    if (editorDraft.status !== 'confirmed') {
      showToast('当前 YAML 剧本尚未最终确认，请确认后再导出。', 'error');
      return;
    }
    try {
      const res = await api.exportFinalYaml(editorDraft.id, fmt);
      if (res.success) {
        showToast(`${editorDc} · ${editorDn} 导出成功`, 'success');
        // 触发浏览器下载
        const dl = await api.downloadFinalYaml(editorDraft.id);
        const blob = await dl.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = res.data?.fileName || `script.${fmt}`; a.click();
        URL.revokeObjectURL(url);
      } else {
        showToast(res.message || '导出失败，请重试。', 'error');
      }
    } catch { showToast('导出失败，请重试。', 'error'); }
  }

  async function handleRestoreLastSaved() {
    if (!editorDraft) return;
    if (!window.confirm('确定要恢复到上一次保存版本吗？当前未保存修改将会丢失。')) return;
    try {
      const res = await api.restoreLastSaved(editorDraft.id);
      if (res.success) { setYamlContent(res.content); setSaveStatus('saved'); lastSavedContent.current = res.content; }
    } catch { showToast('恢复失败', 'error'); }
  }

  async function handleRestoreAiOriginal() {
    if (!editorDraft) return;
    if (!window.confirm('确定要恢复到 AI 原始生成版本吗？当前编辑内容将会被替换。')) return;
    try {
      const res = await api.restoreAiOriginal(editorDraft.id);
      if (res.success) { setYamlContent(res.content); setSaveStatus('unsaved'); }
    } catch { showToast('恢复失败', 'error'); }
  }

  function handleFormatYaml() {
    try {
      // Try to parse as YAML via JS basic formatting
      const lines = yamlContent.split('\n');
      const formatted = lines.map(l => l.trimEnd()).join('\n');
      setYamlContent(formatted);
      showToast('YAML 已格式化', 'success');
    } catch { showToast('YAML 格式错误，无法格式化，请先修正语法。', 'error'); }
  }

  async function handleCopyYaml() {
    try { await navigator.clipboard.writeText(yamlContent); showToast('已复制 YAML 内容。', 'success'); }
    catch { showToast('复制失败', 'error'); }
  }

  async function handleDownloadYaml() {
    if (!editorDraft) return;
    try {
      const res = await api.downloadYamlDraft(editorDraft.id);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `novel_${editorDraft.novel_id}_${editorDc}.yaml`; a.click(); URL.revokeObjectURL(url);
    } catch { showToast('下载失败', 'error'); }
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!username) return null;

  const isDirty = yamlContent !== lastSavedContent.current;

  // === Entry mode: select novel + draft ===
  if (!initialDraftId && !editorDraft) {
    return (
      <div className="flex-1 flex">
        <Sidebar />
        <div className="fixed right-3 top-3 z-40"><BackButton /></div>
        <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
          <div>
            <h2 className="text-xl font-serif font-bold text-ink">YAML 剧本编辑器</h2>
            <p className="text-sm text-ink-light mt-1">选择已有 YAML 剧本草稿，进入编辑、预览、校验和确认流程。</p>
          </div>

          {/* Novel selection */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-ink">选择小说</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {novels.map(novel => (
                <button key={novel.id} onClick={() => selectNovel(novel.id)}
                  className={`text-left p-3 border rounded-lg transition-colors hover:border-accent/30 ${selectedNovelId === novel.id ? 'border-accent bg-accent/5' : 'border-border'}`}>
                  <div className="text-sm font-medium text-ink truncate">{novel.title || '未命名'}</div>
                  <div className="text-xs text-ink-light mt-1">{novel.chapter_count} 章</div>
                </button>
              ))}
            </div>
            {novels.length === 0 && <p className="text-sm text-ink-light py-4">当前暂无小说，请先创建或导入小说。</p>}
          </div>

          {/* Draft selection */}
          {selectedNovelId && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-ink">选择 YAML 草稿版本</h3>
              {drafts.filter(d => d.status !== 'deleted').length === 0 ? (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-ink-light">当前小说还没有 YAML 剧本草稿，请先生成 YAML 剧本。</p>
                  <button onClick={() => router.push(`/novels/${selectedNovelId}/yaml`)}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
                    去生成 YAML 剧本
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(function() {
                    const sorted = sortedActiveDrafts(drafts);
                    return sorted.map(draft => {
                    const stLabel: Record<string, string> = { generated:'已生成', editing:'编辑中', confirmed:'已确认', validation_failed:'校验失败', repair_failed:'修复失败' };
                    const dc = getDisplayCode(draft, sorted);
                    const dn = draft.draft_name || 'AI 生成 YAML';
                    return (
                      <button key={draft.id} onClick={() => enterEditor(draft)}
                        className="w-full text-left p-4 border border-border rounded-lg hover:border-accent/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-ink">{dc} · {dn}</span>
                            <span className="ml-2 text-xs text-ink-light">{stLabel[draft.status] || draft.status}</span>
                          </div>
                          <span className="text-xs text-accent">进入编辑器 →</span>
                        </div>
                        <div className="text-xs text-ink-light mt-1">
                          Schema: {draft.schema_name_snapshot} · {draft.created_at?.substring(0, 16)}
                          {draft.validation_errors && <span className="ml-2 text-warning">⚠ 校验有问题</span>}
                        </div>
                      </button>
                    );
                  }); })()}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // === Editor mode ===
  if (pageLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!editorDraft) return <div className="flex-1 flex items-center justify-center"><p className="text-sm text-error">草稿加载失败</p></div>;

  const sortedActive = sortedActiveDrafts(allNovelDrafts);
  const editorDc = sortedActive.length > 0 ? getDisplayCode(editorDraft, sortedActive) : 'y?';
  const editorDn = editorDraft.draft_name || 'AI 生成 YAML';

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0">
        {/* Editor header */}
        <div className="px-6 py-3 border-b border-border bg-paper/40 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-serif font-bold text-ink">YAML 剧本编辑器</h2>
              <div className="text-xs text-ink-light mt-0.5">{editorDc} · {editorDn} · {editorDraft.schema_name_snapshot}</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <div className="flex bg-paper border border-border rounded-lg overflow-hidden shrink-0">
                {(['yaml','cards','dual'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)}
                    className={`text-xs px-3 py-1.5 transition-colors ${viewMode === m ? 'bg-accent text-white' : 'text-ink-light hover:text-ink'}`}>
                    {{yaml:'YAML',cards:'卡片',dual:'双栏'}[m]}
                  </button>
                ))}
              </div>
              <span className={`text-xs shrink-0 ${isDirty ? 'text-warning' : 'text-ink-light'}`}>
                {isDirty ? '有未保存修改' : saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '保存失败' : '已保存'}
              </span>
              <div className="shrink-0"><BackButton /></div>
            </div>
          </div>

          {/* Validation + Action buttons */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {validationStatus && (
              <ValidationToggle data={validationStatus} expanded={validationExpanded}
                onToggle={() => setValidationExpanded(!validationExpanded)} />
            )}
            <button onClick={handleManualSave} className="px-2 py-1 bg-accent hover:bg-accent-hover text-white rounded">保存修改</button>
            <button onClick={handleRevalidate} disabled={validating}
              className="px-2 py-1 border border-border rounded hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed">{validating ? '校验中...' : '重新校验'}</button>
            <button onClick={handleAiRepair} disabled={repairing}
              className="px-2 py-1 border border-border rounded hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed">{repairing ? '修复中...' : 'AI 修复 YAML'}</button>
            <button onClick={handleConfirm} disabled={validationStatus ? !validationStatus.canConfirm : false}
              className="px-2 py-1 border border-success text-success rounded hover:bg-success/5 disabled:opacity-50 disabled:cursor-not-allowed">确认最终 YAML</button>
            <button onClick={() => handleExport('yaml')} className={`px-2 py-1 rounded transition-colors ${
              editorDraft?.status === 'confirmed' ? 'bg-accent hover:bg-accent-hover text-white' : 'border border-border text-ink-light/50 cursor-not-allowed'
            }`} disabled={editorDraft?.status !== 'confirmed'}>
              {editorDraft?.status === 'confirmed' ? '导出 .yaml' : '导出'}
            </button>
            <span className="text-ink-light/50">|</span>
            <button onClick={handleFormatYaml} className="px-2 py-1 border border-border rounded hover:border-accent/30">格式化</button>
            <button onClick={handleCopyYaml} className="px-2 py-1 border border-border rounded hover:border-accent/30">复制</button>
            <button onClick={handleDownloadYaml} className="px-2 py-1 border border-border rounded hover:border-accent/30">下载</button>
            <button onClick={handleRestoreLastSaved} className="px-2 py-1 border border-border rounded hover:border-accent/30">恢复上次保存</button>
            <button onClick={handleRestoreAiOriginal} className="px-2 py-1 border border-border rounded hover:border-accent/30">恢复AI原始版</button>
          </div>
        </div>

        {/* Validation report panel — full-width dropdown */}
        {validationExpanded && validationStatus && (
          <div className="px-6 bg-error/5 border-b border-error/20 shrink-0 overflow-hidden">
            <div className="max-h-96 overflow-y-auto py-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink text-sm">校验报告</h4>
                <button onClick={() => setValidationExpanded(false)} className="text-ink-light hover:text-ink">收起 ▲</button>
              </div>

              {/* Checks summary */}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {validationStatus.checks.map((check, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${check.status === 'pass' ? 'bg-success' : check.status === 'fail' ? 'bg-error' : 'bg-ink-light/30'}`} />
                    <span className="text-ink-light">{check.name}:</span>
                    <span className={check.status === 'pass' ? 'text-success' : check.status === 'fail' ? 'text-error' : 'text-ink-light/50'}>
                      {check.message}
                    </span>
                  </span>
                ))}
              </div>

              {/* Errors */}
              {validationStatus.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-error">错误 ({validationStatus.errors.length})</div>
                  {validationStatus.errors.map((err, i) => (
                    <div key={i} className="bg-white border border-error/20 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-error/10 text-error font-medium">{err.title}</span>
                        {err.line && (
                          <button onClick={() => jumpToErrorLine(err.line!, err.column)}
                            className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                            📍 第 {err.line} 行{err.column ? `，第 ${err.column} 列` : ''}
                          </button>
                        )}
                        {err.fieldPath && <span className="text-ink-light font-mono">{err.fieldPath}</span>}
                      </div>
                      <p className="text-ink">{err.message}</p>
                      {err.suggestion && <p className="text-ink-light">💡 {err.suggestion}</p>}
                      {err.rawError && <RawErrorBlock text={err.rawError} />}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {validationStatus.warnings.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-warning">警告 ({validationStatus.warnings.length})</div>
                  {validationStatus.warnings.map((w, i) => (
                    <div key={i} className="bg-white border border-warning/20 rounded-lg p-3 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">{w.title}</span>
                        {w.fieldPath && <span className="text-ink-light font-mono">{w.fieldPath}</span>}
                      </div>
                      <p className="text-ink">{w.message}</p>
                      {w.suggestion && <p className="text-ink-light">💡 {w.suggestion}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-ink-light pt-1 border-t border-border">
                可确认: {validationStatus.canConfirm ? <span className="text-success">是</span> : <span className="text-error">否</span>}
                {' · '}可导出: {validationStatus.canExport ? <span className="text-success">是</span> : <span className="text-error">否</span>}
              </div>
            </div>
          </div>
        )}

        {/* Editor body */}
        <div className="flex-1 flex min-h-0">
          {/* YAML code editor */}
          {(viewMode === 'yaml' || viewMode === 'dual') && (
            <div className={`flex flex-col min-h-0 ${viewMode === 'dual' ? 'flex-1 border-r border-border' : 'flex-1'}`}>
              <CodeEditor value={yamlContent} onChange={setYamlContent} errorLine={errorLine} />
            </div>
          )}

          {/* Card preview */}
          {(viewMode === 'cards' || viewMode === 'dual') && (
            <div className={`overflow-y-auto min-h-0 ${viewMode === 'dual' ? 'w-[45%]' : 'flex-1'}`}>
              <YamlStructurePreview yamlText={yamlContent} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Line-numbered code editor
function CodeEditor({ value, onChange, errorLine }: { value: string; onChange: (v: string) => void; errorLine?: number | null }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = value.split('\n').length;

  function syncScroll() {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }

  return (
    <div className="flex flex-1 min-h-0 bg-[#1e1e1e] font-mono text-sm">
      <div ref={gutterRef} className="shrink-0 w-12 overflow-hidden bg-[#252526] text-right select-none pt-3">
        {Array.from({ length: Math.max(lineCount, 1) }, (_, i) => (
          <div key={i}
            className={`leading-[1.6] pr-3 text-xs ${errorLine === i + 1 ? 'bg-[#5a1a1a] text-[#f48771] font-bold' : 'text-[#858585]'}`}
            style={{ height: '1.6em' }}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        className="flex-1 bg-transparent text-[#d4d4d4] outline-none resize-none p-3 leading-[1.6] text-xs border-0 overflow-auto whitespace-pre"
        placeholder="yaml content..."
      />
    </div>
  );
}

function RawErrorBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="text-[10px] text-ink-light/50 hover:text-ink-light">
        {open ? '隐藏' : '查看'}原始错误
      </button>
      {open && (
        <pre className="text-[11px] text-ink-light/60 bg-paper p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-all">
          {text}
        </pre>
      )}
    </div>
  );
}

function ValidationToggle({ data, expanded, onToggle }: {
  data: { valid: boolean; canConfirm: boolean; errors: { severity: string }[]; warnings: unknown[] };
  expanded: boolean; onToggle: () => void;
}) {
  const errorCount = data.errors.filter(e => e.severity === 'error').length;
  const warningCount = data.warnings.length;
  const color = data.valid ? 'bg-success/10 text-success' : errorCount > 0 ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning';
  const text = data.valid ? '检验通过' : errorCount > 0 ? `${errorCount} 个错误` : `${warningCount} 个警告`;
  return (
    <button onClick={onToggle}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${color} hover:opacity-80`}>
      {text} {expanded ? '▲' : '▼'}
    </button>
  );
}

export default function YamlEditorPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>}>
      <YamlEditorInner />
    </Suspense>
  );
}
