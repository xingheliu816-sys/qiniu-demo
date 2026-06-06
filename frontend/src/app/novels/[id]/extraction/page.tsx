'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import ExtractionCard from './ExtractionCard';
import SourceRefDrawer from './SourceRefDrawer';
import Sidebar from '@/components/Sidebar';

const SECTION_ORDER: { key: keyof api.ExtractionResult; title: string; subtitle: string }[] = [
  { key: 'core_story', title: '核心故事', subtitle: '主人公、目标、阻碍、代价、不可逆变化' },
  { key: 'story_overview', title: '故事总览', subtitle: '对当前已导入章节的整体概括' },
  { key: 'chapter_summaries', title: '章节摘要', subtitle: '每章关键事件 / 角色 / 地点 / 戏剧功能' },
  { key: 'characters', title: '主要角色', subtitle: '身份、目标、深层需求、致命缺陷、人物弧光' },
  { key: 'relationships', title: '人物关系', subtitle: '关系类型、演变、关系里的债与秘密' },
  { key: 'locations', title: '地点列表', subtitle: '出现章节、戏剧作用、是否适合成为场景' },
  { key: 'key_events', title: '关键事件', subtitle: '原因、结果、对主线影响' },
  { key: 'timeline', title: '时间线', subtitle: '叙述顺序与真实发生顺序' },
  { key: 'causal_chain', title: '因果链', subtitle: '故事推进的因果而非"然后然后"' },
  { key: 'dramatic_conflicts', title: '戏剧冲突', subtitle: '欲望相撞、选择损失、关系崩塌' },
  { key: 'high_value_scenes', title: '高价值场景', subtitle: '入场 / 在场 / 离场状态变化' },
  { key: 'foreshadowing', title: '伏笔与回收', subtitle: '埋点章节、回收章节、是否保留' },
  { key: 'information_reveal', title: '信息揭示节奏', subtitle: '谁知道什么、何时揭示' },
  { key: 'inner_externalization', title: '内心外化建议', subtitle: '心理 → 可见的动作 / 物件 / 场面' },
  { key: 'dialogue_candidates', title: '台词提炼', subtitle: '潜台词、表层话、真实意图' },
  { key: 'visual_motifs', title: '视觉意象', subtitle: '可作为镜头语言的反复符号' },
  { key: 'theme_questions', title: '主题问题', subtitle: '主题写成问题、不同角色的回答' },
  { key: 'structure_outline', title: '结构骨架', subtitle: '引爆点 / 对抗 / 升级 / 崩塌 / 选择 / 余震' },
  { key: 'cut_and_merge_suggestions', title: '取舍建议', subtitle: '砍 / 合并 / 压缩 / 必保留' },
  { key: 'adaptation_risks', title: '改编风险', subtitle: '心理描写 / 旁白依赖 / 冲突不外显等' },
  { key: 'adaptation_strategy', title: '改编策略', subtitle: '形式、风格、节奏、保留 / 强化建议' },
  { key: 'narrative_perspective', title: '叙事视角', subtitle: '旁白 / 倒叙 / 多线 / 观众视角' },
  { key: 'world_rules', title: '世界观与规则', subtitle: '时代、规则、不能被打破的设定' },
  { key: 'factions', title: '阵营与势力', subtitle: '阵营目标、之间的合作 / 敌对' },
  { key: 'uncertain_items', title: '不确定项', subtitle: '需后续确认的人物关系、动机、伏笔等' },
];

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
  const [novelStatus, setNovelStatus] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');

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

  useEffect(() => {
    if (!isLoading && !username) router.replace('/login');
  }, [isLoading, username, router]);

  const loadAll = useCallback(async () => {
    if (!username || !novelId) return;
    setPageLoading(true);
    try {
      const detail = await api.getNovel(novelId);
      if (!detail.success || !detail.novel) {
        setPageError('小说项目不存在或无权访问');
        return;
      }
      setNovelTitle(detail.novel.title);
      setNovelStatus(detail.novel.status);

      const ext = await api.getExtraction(novelId);
      if (ext.success) {
        setStatus(ext.status);
        setAiResult(ext.aiResult);
        setUserResult(ext.userResult);
        setErrorMessage(ext.errorMessage || '');
      }
    } catch {
      setPageError('加载失败，请稍后重试');
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

  async function handleStart() {
    if (extracting) return;
    if (novelStatus !== 'parsed') {
      showToast('章节识别尚未完成，无法提炼', 'error');
      return;
    }
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
        showToast(data.message || '提炼失败', 'error');
      } else {
        showToast('提炼完成', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '提炼失败';
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-error text-sm mb-4">{pageError}</p>
        <button onClick={() => router.push('/novels')} className="text-accent hover:text-accent-hover text-sm underline underline-offset-2">
          返回我的小说列表
        </button>
      </div>
    );
  }

  if (!username) return null;

  const tone = statusLabel[status] || statusLabel.not_started;
  const canExtract = novelStatus === 'parsed';

  return (
    <div className="flex-1 flex">
      <Sidebar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-serif font-bold text-ink truncate">{novelTitle || '未命名'}</h2>
            <p className="text-sm text-ink-light mt-1">小说提炼 · 故事骨干 JSON 中间层</p>
          </div>
          <span className={`shrink-0 px-3 py-1 rounded text-xs font-medium ${tone.tone}`}>{tone.label}</span>
        </div>

        {!canExtract && (
          <div className="bg-warning/10 border border-warning/20 rounded-xl px-5 py-4 text-sm text-warning">
            该小说尚未完成章节识别，请先回到导入页完成识别后再进行提炼。
            <button onClick={() => router.push(`/novels/${novelId}/import`)} className="ml-3 underline underline-offset-2 hover:text-warning/80">
              回到导入页
            </button>
          </div>
        )}

        {canExtract && status === 'not_started' && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <p className="text-sm text-ink-light">点击下方按钮，AI 将根据已识别章节提炼故事骨干。整个过程可能需要 30 – 90 秒。</p>
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

        {(status === 'extracted' || status === 'editing' || status === 'confirmed') && (
          <>
            <div className="bg-card border border-border rounded-xl px-5 py-4 text-sm text-ink-light flex items-center justify-between gap-3 flex-wrap">
              <span>
                你可以编辑下方任意分区，编辑完成后点「保存最终结果」。保存后的版本会作为后续 YAML 剧本生成的基础。
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? '保存中...' : '保存最终结果'}
              </button>
            </div>

            <div className="space-y-4">
              {SECTION_ORDER.map(({ key, title, subtitle }) => (
                <ExtractionCard
                  key={key}
                  title={title}
                  subtitle={subtitle}
                  value={editingResult[key] ?? (Array.isArray(aiResult?.[key]) ? [] : {})}
                  onChange={(next) => patchSection(key, next as never)}
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
    </div>
  );
}
