const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface ApiError {
  code: string;
  message: string;
}

export function toApiError(error: unknown): ApiError {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.code === 'string' && typeof e.message === 'string') {
      return { code: e.code, message: e.message };
    }
  }
  if (error instanceof Error) {
    return { code: 'UNKNOWN', message: error.message };
  }
  return { code: 'UNKNOWN', message: '未知错误' };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.message || '请求失败');
  }
  return data as T;
}

// ===== 章节相关 =====

export interface ChapterItem {
  id: number;
  novel_id: number;
  chapter_index: number;
  title: string;
  content?: string;
  word_count: number;
  parse_status: string;
  hasExtraction?: boolean;
  extractionStatus?: string;  // 'not_extracted' | 'extracting' | 'extracted' | 'extract_failed'
  created_at: string;
  updated_at: string;
}

export interface ChapterListResponse {
  success: boolean;
  chapters: ChapterItem[];
  message?: string;
}

export interface ChapterDetailResponse {
  success: boolean;
  chapter: ChapterItem;
  message?: string;
}

export interface ChapterCreateResponse {
  success: boolean;
  chapter?: ChapterItem;
  message?: string;
}

export interface ChapterActionResponse {
  success: boolean;
  message: string;
  wordCount?: number;
  errors?: string[];
}

export async function getChapters(novelId: number): Promise<ChapterListResponse> {
  return request<ChapterListResponse>(`/api/novels/${novelId}/chapters`);
}

export async function createChapter(novelId: number, title?: string): Promise<ChapterCreateResponse> {
  return request<ChapterCreateResponse>(`/api/novels/${novelId}/chapters`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function getChapter(chapterId: number): Promise<ChapterDetailResponse> {
  return request<ChapterDetailResponse>(`/api/chapters/${chapterId}`);
}

export async function saveChapter(chapterId: number, data: { title?: string; content?: string }): Promise<ChapterActionResponse> {
  return request<ChapterActionResponse>(`/api/chapters/${chapterId}/save`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function parseChapter(chapterId: number): Promise<ChapterActionResponse> {
  return request<ChapterActionResponse>(`/api/chapters/${chapterId}/parse`, {
    method: 'POST',
  });
}

export async function batchParseChapters(novelId: number, chapterIds: number[]): Promise<ChapterActionResponse> {
  return request<ChapterActionResponse>(`/api/novels/${novelId}/chapters/batch-parse`, {
    method: 'POST',
    body: JSON.stringify({ chapterIds }),
  });
}

export interface ChapterImportPreviewResponse {
  success: boolean;
  data?: { title: string; content: string };
  error?: { code: string; message: string };
  message?: string;
}

export async function importChapterTextPreview(chapterId: number, text: string): Promise<ChapterImportPreviewResponse> {
  return request<ChapterImportPreviewResponse>(`/api/chapters/${chapterId}/import-text-preview`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function importChapterFilePreview(chapterId: number, file: File): Promise<ChapterImportPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  // 不要手动设置 Content-Type，浏览器会自动加上 multipart/form-data 的 boundary
  const res = await fetch(`${API_BASE}/api/chapters/${chapterId}/import-file-preview`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  let data: ChapterImportPreviewResponse | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data) {
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: `请求失败 (HTTP ${res.status})` },
      message: `请求失败 (HTTP ${res.status})`,
    };
  }
  return data;
}

// 合并入口：单章「保存 → 识别前置 → 进入小说提炼」
export interface ChapterExtractResponse extends ExtractionResponse {
  novelId?: number;
  stage?: string;
  parsedCount?: number;
  parseFailedCount?: number;
  parseErrors?: string[];
}

export async function extractFromChapter(
  chapterId: number,
  data?: { title?: string; content?: string }
): Promise<ChapterExtractResponse> {
  return request<ChapterExtractResponse>(`/api/chapters/${chapterId}/extract`, {
    method: 'POST',
    body: JSON.stringify(data || {}),
  });
}

// 合并入口：多章「识别前置 → 进入小说提炼」
export async function extractFromChapters(
  novelId: number,
  chapterIds: number[]
): Promise<ChapterExtractResponse> {
  return request<ChapterExtractResponse>(`/api/novels/${novelId}/chapters/extract`, {
    method: 'POST',
    body: JSON.stringify({ chapterIds }),
  });
}

export async function deleteChapter(chapterId: number): Promise<ChapterActionResponse> {
  return request<ChapterActionResponse>(`/api/chapters/${chapterId}/delete`, {
    method: 'POST',
  });
}

export async function batchDeleteChapters(novelId: number, chapterIds: number[]): Promise<ChapterActionResponse> {
  return request<ChapterActionResponse>(`/api/novels/${novelId}/chapters/delete`, {
    method: 'POST',
    body: JSON.stringify({ chapterIds }),
  });
}

export async function importNovelFile(fileName: string, content: string): Promise<CreateNovelResponse> {
  return request<CreateNovelResponse>('/api/novels/import-file', {
    method: 'POST',
    body: JSON.stringify({ fileName, content }),
  });
}

export async function importNovelLink(url: string): Promise<CreateNovelResponse> {
  return request<CreateNovelResponse>('/api/novels/import-link', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

// ===== 认证 =====

export interface AuthResponse {
  success: boolean;
  message: string;
  username?: string;
}

export interface SessionResponse {
  success: boolean;
  username?: string;
  message?: string;
}

export async function register(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<AuthResponse> {
  return request<AuthResponse>('/api/logout', {
    method: 'POST',
  });
}

export async function getSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/api/session');
}

// ===== 小说 =====

export interface NovelItem {
  id: number;
  title: string;
  status: string;
  total_word_count: number;
  chapter_count: number;
  created_at: string;
  updated_at: string;
  extraction_status?: string;
}

export interface NovelsResponse {
  success: boolean;
  novels: NovelItem[];
}

export interface NovelDetailResponse {
  success: boolean;
  novel: NovelItem & { input_type: string; original_text: string };
}

export interface CreateNovelResponse {
  success: boolean;
  novelId?: number;
  title?: string;
  message?: string;
}

export async function getNovels(): Promise<NovelsResponse> {
  return request<NovelsResponse>('/api/novels');
}

export async function createNovel(title?: string): Promise<CreateNovelResponse> {
  return request<CreateNovelResponse>('/api/novels/create', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function getNovel(novelId: number): Promise<NovelDetailResponse> {
  return request<NovelDetailResponse>(`/api/novels/${novelId}`);
}

export async function saveNovel(novelId: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/novels/${novelId}/save`, {
    method: 'POST',
  });
}

export async function deleteNovel(novelId: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/novels/${novelId}`, {
    method: 'DELETE',
  });
}

export async function renameNovel(novelId: number, title: string): Promise<{ success: boolean; message: string; title?: string }> {
  return request(`/api/novels/${novelId}/rename`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function renameChapter(chapterId: number, title: string): Promise<{ success: boolean; message: string; title?: string }> {
  return request(`/api/chapters/${chapterId}/rename`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

// ===== YAML 剧本生成 =====

export interface YamlDraftItem {
  id: number;
  novel_id: number;
  version: number;
  version_type: string;
  draft_name?: string;
  schema_name_snapshot: string;
  yaml_content: string;
  user_edited_content?: string;
  status: string;
  error_message?: string;
  validation_errors?: string;
  repair_count: number;
  file_path?: string;
  created_at: string;
  updated_at: string;
}

export async function generateYaml(novelId: number, schemaId?: number | string | null, useSchema?: boolean): Promise<{ success: boolean; message: string; draft?: YamlDraftItem }> {
  return request(`/api/novels/${novelId}/yaml-generate`, {
    method: 'POST',
    body: JSON.stringify({ schemaId, useSchema }),
  });
}

export async function getYamlDrafts(novelId: number): Promise<{ success: boolean; drafts: YamlDraftItem[] }> {
  return request(`/api/novels/${novelId}/yaml-drafts`);
}

export async function getYamlDraft(draftId: number): Promise<{ success: boolean; draft: YamlDraftItem }> {
  return request(`/api/yaml-drafts/${draftId}`);
}

export async function saveYamlDraft(draftId: number, yamlContent: string): Promise<{ success: boolean; message: string }> {
  return request(`/api/yaml-drafts/${draftId}/save`, {
    method: 'POST',
    body: JSON.stringify({ yamlContent }),
  });
}

export async function validateYamlDraft(draftId: number): Promise<{ success: boolean; data?: {
  valid: boolean; yamlSyntaxValid: boolean; schemaValid: boolean | null;
  canConfirm: boolean; canExport: boolean;
  errors: { type: string; severity: string; title: string; line?: number; column?: number; fieldPath?: string; message: string; suggestion?: string; rawError?: string }[];
  warnings: { type: string; severity: string; title: string; line?: number; fieldPath?: string; message: string; suggestion?: string }[];
  checks: { name: string; status: string; message: string; warningCount?: number }[];
} }> {
  return request(`/api/yaml-drafts/${draftId}/validate`, {
    method: 'POST',
  });
}

export async function confirmYamlDraft(draftId: number): Promise<{ success: boolean; message: string }> {
  return request(`/api/yaml-drafts/${draftId}/confirm`, {
    method: 'POST',
  });
}

export async function deleteYamlDraft(draftId: number): Promise<{ success: boolean; message: string }> {
  return request(`/api/yaml-drafts/${draftId}/delete`, {
    method: 'POST',
  });
}

export async function regenerateYaml(novelId: number, schemaId?: number | string | null, useSchema?: boolean): Promise<{ success: boolean; message: string; draft?: YamlDraftItem }> {
  return request(`/api/novels/${novelId}/yaml-regenerate`, {
    method: 'POST',
    body: JSON.stringify({ schemaId, useSchema }),
  });
}

export async function restoreLastSaved(draftId: number): Promise<{ success: boolean; content: string }> {
  return request(`/api/yaml-drafts/${draftId}/restore-last-saved`, { method: 'POST' });
}

export async function restoreAiOriginal(draftId: number): Promise<{ success: boolean; content: string }> {
  return request(`/api/yaml-drafts/${draftId}/restore-ai-original`, { method: 'POST' });
}

export async function aiRepairYaml(draftId: number): Promise<{ success: boolean; draftId?: number; version?: number; content?: string; message?: string }> {
  return request(`/api/yaml-drafts/${draftId}/ai-repair`, { method: 'POST' });
}

export async function downloadYamlDraft(draftId: number): Promise<Response> {
  return fetch(`${API_BASE}/api/yaml-drafts/${draftId}/download`, { credentials: 'include' });
}

export async function autosaveYamlDraft(draftId: number, yamlContent: string): Promise<{ success: boolean; message: string }> {
  return request(`/api/yaml-drafts/${draftId}/autosave`, {
    method: 'POST',
    body: JSON.stringify({ yamlContent }),
  });
}

export interface ExportResult {
  id: number;
  fileName: string;
  filePath: string;
  format: string;
}

/** 根据当前小说下所有未删除 YAML 版本按 created_at 排序，计算展示编号 y1/y2/y3。 */
export function getDisplayCode(draft: YamlDraftItem, sortedActiveDrafts: YamlDraftItem[]): string {
  const idx = sortedActiveDrafts.findIndex(d => d.id === draft.id);
  return `y${idx + 1}`;
}

/** 返回 "y{n} · {draftName}" 格式的统一显示名称。 */
export function getDisplayName(draft: YamlDraftItem, sortedActiveDrafts: YamlDraftItem[]): string {
  const code = getDisplayCode(draft, sortedActiveDrafts);
  const name = draft.draft_name || 'AI 生成 YAML';
  return `${code} · ${name}`;
}

/** 返回排序+过滤后的活跃草稿列表（排除 deleted，按 created_at 升序）。 */
export function sortedActiveDrafts(drafts: YamlDraftItem[]): YamlDraftItem[] {
  return drafts
    .filter(d => d.status !== 'deleted')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export async function exportFinalYaml(draftId: number, format?: string): Promise<{ success: boolean; message: string; data?: ExportResult }> {
  return request(`/api/yaml-drafts/${draftId}/export`, {
    method: 'POST',
    body: JSON.stringify({ format: format || 'yaml' }),
  });
}

export async function downloadFinalYaml(draftId: number): Promise<Response> {
  return fetch(`${API_BASE}/api/yaml-drafts/${draftId}/download-final`, { credentials: 'include' });
}

export async function batchDeleteYamlDrafts(draftIds: number[]): Promise<{ success: boolean; message?: string; data?: { deletedCount: number; failedCount: number } }> {
  return request('/api/yaml-drafts/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ draftIds }),
  });
}

export async function updateYamlDraftName(draftId: number, draftName: string): Promise<{ success: boolean; message?: string; data?: { draftName: string } }> {
  return request(`/api/yaml-drafts/${draftId}`, {
    method: 'PATCH',
    body: JSON.stringify({ draftName }),
  });
}

// ===== 历史记录 =====

export interface HistoryRecord {
  id: number;
  title: string;
  input_type: string;
  total_word_count: number;
  chapter_count: number;
  is_success: number;
  message: string;
  created_at: string;
}

export interface HistoryResponse {
  success: boolean;
  records: HistoryRecord[];
}

export async function getHistory(): Promise<HistoryResponse> {
  return request<HistoryResponse>('/api/history');
}

// ===== 小说提炼 =====

export interface SourceRef {
  chapter_id?: number;
  chapter_title?: string;
  start_offset?: number;
  end_offset?: number;
  excerpt_preview?: string;
}

export interface UncertainItem {
  type?: string;
  content?: string;
  reason?: string;
  source_refs?: SourceRef[];
}

export interface ExtractionResult {
  core_story?: Record<string, unknown>;
  story_overview?: Record<string, unknown>;
  chapter_summaries?: Record<string, unknown>[];
  characters?: Record<string, unknown>[];
  relationships?: Record<string, unknown>[];
  locations?: Record<string, unknown>[];
  key_events?: Record<string, unknown>[];
  timeline?: Record<string, unknown>;
  causal_chain?: Record<string, unknown>[];
  dramatic_conflicts?: Record<string, unknown>[];
  high_value_scenes?: Record<string, unknown>[];
  foreshadowing?: Record<string, unknown>[];
  information_reveal?: Record<string, unknown>[];
  inner_externalization?: Record<string, unknown>[];
  dialogue_candidates?: Record<string, unknown>[];
  visual_motifs?: Record<string, unknown>[];
  theme_questions?: Record<string, unknown>[];
  structure_outline?: Record<string, unknown>;
  cut_and_merge_suggestions?: Record<string, unknown>[];
  adaptation_risks?: Record<string, unknown>[];
  adaptation_strategy?: Record<string, unknown>;
  narrative_perspective?: Record<string, unknown>;
  world_rules?: Record<string, unknown>[];
  factions?: Record<string, unknown>[];
  uncertain_items?: UncertainItem[];
  [key: string]: unknown;
}

export interface ChapterExtractionItem {
  chapterId: number;
  chapterIndex?: number;
  chapterTitle: string;
  status: string;
  extraction: Record<string, unknown> | null;
}

export interface ExtractionResponse {
  success: boolean;
  status: string;
  aiResult: ExtractionResult | null;
  userResult: ExtractionResult | null;
  errorMessage?: string | null;
  message?: string;
  chapterExtractions?: ChapterExtractionItem[];
}

export interface AllExtractionsResponse {
  success: boolean;
  data?: {
    novelExtraction: {
      status: string;
      aiResult: ExtractionResult | null;
      userResult: ExtractionResult | null;
      errorMessage: string | null;
    } | null;
    chapterExtractions: ChapterExtractionItem[];
  };
  message?: string;
}

export interface SourceRefResponse {
  success: boolean;
  chapter_id?: number;
  chapter_title?: string;
  start_offset?: number;
  end_offset?: number;
  excerpt?: string;
  full_length?: number;
  message?: string;
}

export async function triggerExtraction(novelId: number): Promise<ExtractionResponse> {
  return request<ExtractionResponse>(`/api/novels/${novelId}/extract`, {
    method: 'POST',
  });
}

export async function getExtraction(novelId: number): Promise<ExtractionResponse> {
  return request<ExtractionResponse>(`/api/novels/${novelId}/extraction`);
}

export async function getAllExtractions(novelId: number): Promise<AllExtractionsResponse> {
  return request<AllExtractionsResponse>(`/api/novels/${novelId}/extractions/all`);
}

export async function getChapterExtraction(chapterId: number): Promise<{
  success: boolean;
  extraction?: Record<string, unknown>;
  status?: string;
  message?: string;
}> {
  return request(`/api/chapters/${chapterId}/extraction`);
}

export async function saveChapterExtraction(
  chapterId: number,
  extractionJson: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  return request(`/api/chapters/${chapterId}/extraction/save`, {
    method: 'POST',
    body: JSON.stringify({ extractionJson }),
  });
}

/** 单章独立 AI 提炼：只对该章节调 AI，保存到 chapter_extractions。不触发整本小说提炼。 */
export async function extractChapterOnly(chapterId: number): Promise<{
  success: boolean;
  message?: string;
  status?: string;
  extraction?: Record<string, unknown>;
  source?: string;
}> {
  return request(`/api/chapters/${chapterId}/extract-only`, {
    method: 'POST',
  });
}

export async function saveExtraction(novelId: number, userResult: ExtractionResult): Promise<{ success: boolean; message: string; status?: string }> {
  return request<{ success: boolean; message: string; status?: string }>(`/api/novels/${novelId}/extraction/save`, {
    method: 'POST',
    body: JSON.stringify({ userResult }),
  });
}

export async function getSourceRef(novelId: number, chapterId: number, startOffset: number, endOffset: number): Promise<SourceRefResponse> {
  const qs = new URLSearchParams({
    chapter_id: String(chapterId),
    start_offset: String(startOffset),
    end_offset: String(endOffset),
  });
  return request<SourceRefResponse>(`/api/novels/${novelId}/source-ref?${qs.toString()}`);
}

// ===== YAML Schema 规则库 =====

export interface SchemaItem {
  id: number;
  user_id: number | null;
  name: string;
  description: string | null;
  schema_type: string | null;
  content_format: string;
  content: string;
  is_default: number;
  is_system: number;
  status: string;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface SchemasResponse {
  success: boolean;
  system_schemas: SchemaItem[];
  user_schemas: SchemaItem[];
  default_schema_id: number | null;
  message?: string;
}

export interface SchemaDetailResponse {
  success: boolean;
  schema: SchemaItem;
  message?: string;
}

export interface SchemaCreateResponse {
  success: boolean;
  schemaId?: number;
  message?: string;
}

export interface SchemaActionResponse {
  success: boolean;
  message?: string;
}

export async function getSchemas(): Promise<SchemasResponse> {
  return request<SchemasResponse>('/api/schemas');
}

export async function getSchema(schemaId: number): Promise<SchemaDetailResponse> {
  return request<SchemaDetailResponse>(`/api/schemas/${schemaId}`);
}

export async function createSchema(data: {
  name?: string;
  description?: string;
  schemaType?: string;
  contentFormat: string;
  content: string;
}): Promise<SchemaCreateResponse> {
  return request<SchemaCreateResponse>('/api/schemas/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSchema(schemaId: number, data: {
  name?: string;
  description?: string;
  schemaType?: string;
  contentFormat?: string;
  content?: string;
}): Promise<SchemaActionResponse> {
  return request<SchemaActionResponse>(`/api/schemas/${schemaId}/update`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteSchema(schemaId: number): Promise<SchemaActionResponse> {
  return request<SchemaActionResponse>(`/api/schemas/${schemaId}/delete`, {
    method: 'POST',
  });
}

export async function copySchema(schemaId: number): Promise<SchemaCreateResponse> {
  return request<SchemaCreateResponse>(`/api/schemas/${schemaId}/copy`, {
    method: 'POST',
  });
}

export async function setDefaultSchema(schemaId: number | null): Promise<SchemaActionResponse> {
  return request<SchemaActionResponse>('/api/schemas/set-default', {
    method: 'POST',
    body: JSON.stringify({ schemaId }),
  });
}

// ===== 关系图谱（功能 5） =====

export interface GraphSourceRef {
  chapter_id?: number | string;
  chapter_title?: string;
  excerpt_preview?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  subtype?: string;
  importance?: 'high' | 'medium' | 'low' | string;
  description?: string;
  source_refs?: GraphSourceRef[];
  uncertainty?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  strength?: 'high' | 'medium' | 'low' | string;
  description?: string;
  source_refs?: GraphSourceRef[];
}

export interface GraphGroup {
  id: string;
  label: string;
  node_type: string;
}

export interface GraphData {
  graph_meta?: {
    novel_id?: number;
    novel_title?: string;
    chapter_ids?: number[];
    generated_from?: string;
    version?: string;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups?: GraphGroup[];
}

export interface GraphRecord {
  id?: number;
  user_id?: number;
  novel_id?: number;
  chapter_ids?: number[];
  graph_data_json: GraphData;
  status: string;
  error_report?: string;
  node_count?: number;
  edge_count?: number;
  generated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getRelationshipGraph(novelId: number): Promise<{ success: boolean; graph: GraphRecord | null }> {
  return request(`/api/novels/${novelId}/relationship-graph`);
}

export async function generateRelationshipGraph(novelId: number, chapterIds: number[]): Promise<{ success: boolean; message: string; graph: GraphRecord | null }> {
  return request(`/api/novels/${novelId}/relationship-graph/generate`, {
    method: 'POST',
    body: JSON.stringify({ chapterIds }),
  });
}

export async function appendChaptersToGraph(novelId: number, chapterIds: number[]): Promise<{ success: boolean; message: string; graph: GraphRecord | null }> {
  return request(`/api/novels/${novelId}/relationship-graph/append`, {
    method: 'POST',
    body: JSON.stringify({ chapterIds }),
  });
}

export async function deleteRelationshipGraph(novelId: number): Promise<{ success: boolean; message?: string }> {
  return request(`/api/novels/${novelId}/relationship-graph`, {
    method: 'DELETE',
  });
}
