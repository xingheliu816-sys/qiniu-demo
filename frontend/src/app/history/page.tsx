'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import * as api from '@/lib/api';
import Sidebar from '@/components/Sidebar';

export default function HistoryPage() {
  const { username, isLoading } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<api.HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !username) {
      router.replace('/login');
    }
  }, [isLoading, username, router]);

  useEffect(() => {
    if (username) {
      api.getHistory()
        .then((data) => {
          if (data.success) setRecords(data.records);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [username]);

  const inputTypeMap: Record<string, string> = {
    paste: '粘贴',
    txt_upload: '文件上传',
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-ink-light font-serif text-lg">加载中...</div>
      </div>
    );
  }

  if (!username) return null;

  return (
    <div className="flex-1 flex">
      <Sidebar />

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <h2 className="text-xl font-serif font-bold text-ink mb-6">我的导入与识别记录</h2>

        {loading ? (
          <div className="text-center py-16 text-sm text-ink-light">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-sm text-ink-light">暂无记录。</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-paper/50">
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">小说标题</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">输入方式</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">总字数</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">章节数</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">提示信息</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-light text-xs">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-paper/30 transition-colors">
                      <td className="px-4 py-3 text-ink">{r.title}</td>
                      <td className="px-4 py-3 text-ink-light">{inputTypeMap[r.input_type] || r.input_type}</td>
                      <td className="px-4 py-3 text-ink">{r.total_word_count}</td>
                      <td className="px-4 py-3 text-ink">{r.chapter_count ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          r.is_success === 1
                            ? 'bg-success/10 text-success'
                            : 'bg-error/10 text-error'
                        }`}>
                          {r.is_success === 1 ? '成功' : '不足'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-light text-xs max-w-[200px] truncate">{r.message || ''}</td>
                      <td className="px-4 py-3 text-ink-light text-xs whitespace-nowrap">
                        {r.created_at ? r.created_at.substring(0, 19).replace('T', ' ') : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
