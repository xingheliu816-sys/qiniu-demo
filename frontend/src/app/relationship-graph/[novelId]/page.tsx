'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import BackButton from '@/components/BackButton';
import RelationshipGraphCanvas, { NODE_TYPE_COLORS } from '../RelationshipGraphCanvas';
import type { GraphNode, GraphEdge, GraphRecord } from '@/lib/api';

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

// 分类胶囊定义
const CATEGORIES: { id: string; label: string; types: string[] }[] = [
  { id: 'all', label: '总览', types: [] },
  { id: 'character', label: '人物', types: ['character', 'faction'] },
  { id: 'plot', label: '故事', types: ['plot', 'event', 'conflict'] },
  { id: 'location', label: '地点', types: ['location'] },
  { id: 'event', label: '事件', types: ['event'] },
  { id: 'conflict', label: '冲突', types: ['conflict'] },
  { id: 'clue', label: '线索', types: ['clue', 'object'] },
];

const TYPE_LABEL: Record<string, string> = {
  character: '人物',
  location: '地点',
  event: '事件',
  plot: '故事',
  conflict: '冲突',
  clue: '线索',
  faction: '阵营',
  object: '物件',
  theme: '主题',
};

export default function RelationshipGraphDetailPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const novelId = Number(params.novelId) || 0;

  const [novelTitle, setNovelTitle] = useState('');
  const [chapters, setChapters] = useState<api.ChapterItem[]>([]);
  const [graph, setGraph] = useState<GraphRecord | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Selection modal state
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [selectModalMode, setSelectModalMode] = useState<'generate' | 'append'>('generate');
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<number>>(new Set());

  // Filters
  const [currentCategory, setCurrentCategory] = useState('all');
  const [chapterFilter, setChapterFilter] = useState<Set<number>>(new Set());

  // Detail panels
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  const loadAll = useCallback(async () => {
    if (!username || !novelId) return;
    setPageLoading(true);
    try {
      const novelRes = await api.getNovel(novelId);
      if (novelRes.success && novelRes.novel) setNovelTitle(novelRes.novel.title || '未命名');

      const chRes = await api.getChapters(novelId);
      setChapters(chRes.chapters || []);

      const graphRes = await api.getRelationshipGraph(novelId);
      if (graphRes.success) setGraph(graphRes.graph);
    } catch (e) {
      console.error(e);
    } finally {
      setPageLoading(false);
    }
  }, [username, novelId]);

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const extractedChapters = chapters.filter(c => c.extractionStatus === 'extracted');
  const usedChapterIds = new Set(graph?.chapter_ids || []);
  const newExtractedChapters = extractedChapters.filter(c => !usedChapterIds.has(c.id));

  function openGenerateModal() {
    setSelectModalMode('generate');
    setSelectedChapterIds(new Set(extractedChapters.map(c => c.id)));
    setSelectModalOpen(true);
  }

  function openAppendModal() {
    setSelectModalMode('append');
    setSelectedChapterIds(new Set(newExtractedChapters.map(c => c.id)));
    setSelectModalOpen(true);
  }

  function toggleChapterSelect(chId: number) {
    setSelectedChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(chId)) next.delete(chId); else next.add(chId);
      return next;
    });
  }

  async function handleConfirmSelection() {
    const ids = Array.from(selectedChapterIds);
    if (ids.length === 0) { showToast('请至少选择一个已提炼章节。', 'error'); return; }
    setSelectModalOpen(false);
    setGenerating(true);
    try {
      const res = selectModalMode === 'generate'
        ? await api.generateRelationshipGraph(novelId, ids)
        : await api.appendChaptersToGraph(novelId, ids);
      if (res.success) {
        showToast(res.message || '操作成功', 'success');
        if (res.graph) setGraph(res.graph);
      } else {
        showToast(res.message || '操作失败', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('确定要清空当前关系图谱吗？该操作不可撤销。')) return;
    try {
      const res = await api.deleteRelationshipGraph(novelId);
      if (res.success) {
        showToast('已清空关系图谱', 'success');
        setGraph(null);
        setSelectedNode(null);
        setSelectedEdge(null);
      } else {
        showToast('删除失败', 'error');
      }
    } catch { showToast('删除失败', 'error'); }
  }

  // 当前类型过滤集合
  const activeCategory = CATEGORIES.find(c => c.id === currentCategory) || CATEGORIES[0];
  const typeFilter = new Set(activeCategory.types);

  if (isLoading || pageLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div></div>;
  if (!username) return null;

  const hasGraph = graph && graph.graph_data_json && (graph.graph_data_json.nodes || []).length > 0;

  return (
    <div className="flex-1 flex">
      <Sidebar />
      <div className="fixed right-3 top-3 z-40"><BackButton /></div>
      <main className="flex-1 flex flex-col min-h-0 p-4 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-serif font-bold text-ink">关系图谱 · 《{novelTitle}》</h2>
            <p className="text-xs text-ink-light mt-1">根据已完成提炼的章节内容，生成人物、故事、地点和事件关系网络。</p>
          </div>
          <div className="flex items-center gap-2">
            {extractedChapters.length === 0 ? (
              <span className="text-xs text-ink-light/60">当前小说没有已提炼章节</span>
            ) : !hasGraph ? (
              <button onClick={openGenerateModal} disabled={generating}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg">
                {generating ? '生成中...' : '生成关系图谱'}
              </button>
            ) : (
              <>
                <button onClick={openAppendModal} disabled={generating || newExtractedChapters.length === 0}
                  className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg">
                  添加已提炼章节{newExtractedChapters.length > 0 ? ` (${newExtractedChapters.length})` : ''}
                </button>
                <button onClick={openGenerateModal} disabled={generating}
                  className="px-3 py-2 border border-border text-xs text-ink-light hover:border-accent/30 rounded-lg disabled:opacity-50">
                  重新生成
                </button>
                <button onClick={handleDelete} className="px-3 py-2 border border-error text-xs text-error hover:bg-error/5 rounded-lg">
                  清空图谱
                </button>
              </>
            )}
          </div>
        </div>

        {/* Empty states */}
        {extractedChapters.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-3">🕸️</div>
              <h3 className="text-base font-serif font-bold text-ink mb-2">当前小说还没有已提炼章节</h3>
              <p className="text-sm text-ink-light">请先完成章节提炼后再生成关系图谱。</p>
              <button onClick={() => router.push(`/novels/${novelId}/extraction`)}
                className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg">
                去提炼章节
              </button>
            </div>
          </div>
        )}

        {extractedChapters.length > 0 && !hasGraph && !generating && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-3">🕸️</div>
              <h3 className="text-base font-serif font-bold text-ink mb-2">关系图谱尚未生成</h3>
              <p className="text-sm text-ink-light">请选择已经完成提炼的章节，系统会根据人物、地点、事件、故事线索生成关系图谱。</p>
              <button onClick={openGenerateModal}
                className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg">
                选择章节并生成
              </button>
            </div>
          </div>
        )}

        {generating && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-pulse text-base text-ink-light font-serif">正在生成关系图谱……</div>
              <p className="text-xs text-ink-light/60 mt-2">系统正在分析已提炼内容中的人物、地点、事件和故事关系，请稍候。</p>
            </div>
          </div>
        )}

        {/* Graph view */}
        {hasGraph && !generating && (
          <>
            {/* Top category pills */}
            <div className="flex items-center justify-center mb-3">
              <div className="inline-flex bg-card border border-border rounded-full p-1 shadow-sm flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat.id}
                    onClick={() => setCurrentCategory(cat.id)}
                    className={`px-4 py-1.5 text-xs rounded-full transition-colors ${currentCategory === cat.id ? 'bg-ink text-white' : 'text-ink-light hover:text-ink'}`}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Graph + Side panel */}
            <div className="flex-1 flex gap-3 min-h-0">
              {/* Left: chapter filter + canvas */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2">
                {/* Chapter filter */}
                {chapters.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap bg-card border border-border rounded-lg px-3 py-2">
                    <span className="text-xs text-ink-light shrink-0">章节筛选：</span>
                    <button onClick={() => setChapterFilter(new Set())}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${chapterFilter.size === 0 ? 'bg-accent text-white' : 'border border-border text-ink-light hover:border-accent/30'}`}>
                      全部
                    </button>
                    {(graph?.chapter_ids || []).map(cid => {
                      const ch = chapters.find(c => c.id === cid);
                      if (!ch) return null;
                      const active = chapterFilter.has(cid);
                      return (
                        <button key={cid}
                          onClick={() => setChapterFilter(prev => {
                            const next = new Set(prev);
                            if (next.has(cid)) next.delete(cid); else next.add(cid);
                            return next;
                          })}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors truncate max-w-[140px] ${active ? 'bg-accent text-white' : 'border border-border text-ink-light hover:border-accent/30'}`}>
                          {ch.title}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex-1 min-h-[400px] bg-card border border-border rounded-xl overflow-hidden">
                  <RelationshipGraphCanvas
                    data={graph!.graph_data_json}
                    typeFilter={typeFilter}
                    chapterFilter={chapterFilter}
                    onNodeClick={(n) => { setSelectedNode(n); setSelectedEdge(null); }}
                    onEdgeClick={(e) => { setSelectedEdge(e); setSelectedNode(null); }}
                  />
                </div>

                {/* Stats footer */}
                <div className="bg-paper/40 border border-border rounded-lg px-3 py-2 text-xs text-ink-light flex items-center justify-between flex-wrap gap-2">
                  <span>节点 {graph!.node_count ?? graph!.graph_data_json.nodes.length} · 边 {graph!.edge_count ?? graph!.graph_data_json.edges.length}</span>
                  <span>章节范围 {graph!.chapter_ids?.length || 0} 章 · 更新于 {graph!.updated_at?.substring(0, 16)}</span>
                </div>

                {/* Legend */}
                <div className="bg-paper/40 border border-border rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap text-xs">
                  <span className="text-ink-light">图例：</span>
                  {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
                    <span key={type} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-ink-light">{TYPE_LABEL[type] || type}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: detail panel */}
              <div className="w-72 shrink-0 bg-card border border-border rounded-xl p-4 overflow-y-auto min-h-0">
                {!selectedNode && !selectedEdge && (
                  <div className="text-center py-8">
                    <p className="text-xs text-ink-light">点击图中的节点或边查看详情。</p>
                  </div>
                )}

                {selectedNode && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_TYPE_COLORS[selectedNode.type] || '#999' }} />
                      <span className="text-xs px-1.5 py-0.5 rounded bg-paper text-ink-light">{TYPE_LABEL[selectedNode.type] || selectedNode.type}</span>
                      {selectedNode.subtype && <span className="text-xs text-ink-light">· {selectedNode.subtype}</span>}
                    </div>
                    <h3 className="text-base font-serif font-bold text-ink">{selectedNode.label}</h3>
                    {selectedNode.importance && (
                      <div className="text-xs"><span className="text-ink-light">重要性：</span><span className="text-ink">{selectedNode.importance}</span></div>
                    )}
                    {selectedNode.description && (
                      <div className="text-xs">
                        <div className="text-ink-light mb-1">描述</div>
                        <p className="text-ink leading-relaxed">{selectedNode.description}</p>
                      </div>
                    )}
                    {selectedNode.uncertainty && (
                      <div className="text-xs text-warning bg-warning/5 border border-warning/20 rounded p-2">⚠ 该节点存在不确定性</div>
                    )}
                    {selectedNode.source_refs && selectedNode.source_refs.length > 0 && (
                      <div className="text-xs">
                        <div className="text-ink-light mb-1">来源章节</div>
                        <ul className="space-y-1.5">
                          {selectedNode.source_refs.map((r, i) => (
                            <li key={i} className="bg-paper rounded p-2">
                              <div className="text-ink">{r.chapter_title || `第 ${r.chapter_id} 章`}</div>
                              {r.excerpt_preview && <div className="text-ink-light mt-1 text-[11px]">{r.excerpt_preview}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button onClick={() => setSelectedNode(null)} className="text-xs text-ink-light hover:text-ink w-full text-center pt-2">关闭</button>
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-3">
                    <div className="text-xs"><span className="text-ink-light">关系类型：</span><span className="text-ink font-medium">{selectedEdge.label || selectedEdge.type}</span></div>
                    <h3 className="text-sm font-serif font-bold text-ink">
                      {(graph!.graph_data_json.nodes.find(n => n.id === selectedEdge.source)?.label || selectedEdge.source)}
                      <span className="mx-2 text-ink-light">→</span>
                      {(graph!.graph_data_json.nodes.find(n => n.id === selectedEdge.target)?.label || selectedEdge.target)}
                    </h3>
                    {selectedEdge.strength && (
                      <div className="text-xs"><span className="text-ink-light">强度：</span><span className="text-ink">{selectedEdge.strength}</span></div>
                    )}
                    {selectedEdge.description && (
                      <div className="text-xs">
                        <div className="text-ink-light mb-1">说明</div>
                        <p className="text-ink leading-relaxed">{selectedEdge.description}</p>
                      </div>
                    )}
                    {selectedEdge.source_refs && selectedEdge.source_refs.length > 0 && (
                      <div className="text-xs">
                        <div className="text-ink-light mb-1">来源章节</div>
                        <ul className="space-y-1.5">
                          {selectedEdge.source_refs.map((r, i) => (
                            <li key={i} className="bg-paper rounded p-2">
                              <div className="text-ink">{r.chapter_title || `第 ${r.chapter_id} 章`}</div>
                              {r.excerpt_preview && <div className="text-ink-light mt-1 text-[11px]">{r.excerpt_preview}</div>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button onClick={() => setSelectedEdge(null)} className="text-xs text-ink-light hover:text-ink w-full text-center pt-2">关闭</button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Chapter selection modal */}
        {selectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-ink">{selectModalMode === 'generate' ? '选择用于生成关系图谱的章节' : '追加章节到关系图谱'}</h3>
                <button onClick={() => setSelectModalOpen(false)} className="text-ink-light hover:text-ink text-lg">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {chapters.length === 0 ? (
                  <p className="text-sm text-ink-light text-center py-8">当前小说暂无章节</p>
                ) : (
                  chapters.map(ch => {
                    const isExtracted = ch.extractionStatus === 'extracted';
                    const alreadyInGraph = selectModalMode === 'append' && usedChapterIds.has(ch.id);
                    const disabled = !isExtracted || alreadyInGraph;
                    return (
                      <label key={ch.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-paper/50'}`}>
                        <input type="checkbox"
                          checked={selectedChapterIds.has(ch.id)}
                          onChange={() => toggleChapterSelect(ch.id)}
                          disabled={disabled}
                          className="w-4 h-4 accent-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-ink">{ch.title}</span>
                          <span className="ml-2 text-xs text-ink-light">{ch.word_count} 字</span>
                        </div>
                        <span className={`text-xs shrink-0 ${alreadyInGraph ? 'text-ink-light/50' : isExtracted ? 'text-success' : 'text-ink-light/50'}`}>
                          {alreadyInGraph ? '已加入' : isExtracted ? '已提炼' : '未提炼'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="px-6 py-3 border-t border-border flex items-center justify-between">
                <span className="text-xs text-ink-light">已选择 {selectedChapterIds.size} 个已提炼章节</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectModalOpen(false)} className="px-4 py-2 text-sm text-ink-light border border-border rounded-lg">取消</button>
                  <button onClick={handleConfirmSelection}
                    disabled={selectedChapterIds.size === 0}
                    className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-white rounded-lg disabled:opacity-50">
                    {selectModalMode === 'generate' ? '生成关系图谱' : '追加生成'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
