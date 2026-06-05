'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const err = await login(username, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      router.replace('/novels');
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif font-bold text-ink">Novel2Script AI</h1>
          <p className="text-ink-light mt-2 text-sm">登录以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-ink mb-1.5">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
              autoFocus
              className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg text-sm text-ink placeholder:text-ink-light/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-colors"
            />
          </div>

          {error && (
            <div className="bg-error/10 border border-error/20 text-error text-sm rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-light mt-8">
          还没有账号？{' '}
          <Link href="/register" className="text-accent hover:text-accent-hover underline underline-offset-2 transition-colors">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
