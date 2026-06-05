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

export interface ParseChapter {
  id?: number;
  index: number;
  title: string;
  content: string;
  wordCount: number;
}

export interface ParseResult {
  success: boolean;
  novelId?: number | null;
  title: string;
  totalWordCount: number;
  chapterCount: number;
  isEnoughChapters: boolean;
  message: string;
  chapters: ParseChapter[];
}

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

export interface NovelItem {
  id: number;
  title: string;
  status: string;
  total_word_count: number;
  chapter_count: number;
  created_at: string;
  updated_at: string;
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

export async function parseChapters(title: string, content: string, inputType: string, chapterName?: string): Promise<ParseResult> {
  return request<ParseResult>('/api/parse-chapters', {
    method: 'POST',
    body: JSON.stringify({ title, content, inputType, chapterName }),
  });
}

export async function updateChapterTitle(chapterId: number, title: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/api/chapters/update-title', {
    method: 'POST',
    body: JSON.stringify({ chapterId, title }),
  });
}

export async function getHistory(): Promise<HistoryResponse> {
  return request<HistoryResponse>('/api/history');
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

export async function parseChaptersWithNovel(novelId: number, title: string, content: string, inputType: string, chapterName?: string): Promise<ParseResult> {
  return request<ParseResult>('/api/parse-chapters', {
    method: 'POST',
    body: JSON.stringify({ title, content, inputType, chapterName, novelId }),
  });
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
