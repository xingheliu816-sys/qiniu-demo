const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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

export interface ExtractionResponse {
  success: boolean;
  status: string;
  aiResult: ExtractionResult | null;
  userResult: ExtractionResult | null;
  errorMessage?: string | null;
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
