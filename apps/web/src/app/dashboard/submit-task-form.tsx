'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function SubmitTaskForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!prompt.trim()) return;

    startTransition(async () => {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setPrompt('');
      setSuccess('Task submitted. It will appear in the Review Queue when complete.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-zinc-700" htmlFor="prompt">
        Submit a task
      </label>
      <textarea
        id="prompt"
        rows={3}
        required
        maxLength={4000}
        placeholder="e.g. find 5 software engineering intern postings at SF-based YC companies"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={pending || !prompt.trim()}
          className="px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? 'Submitting…' : 'Submit'}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      </div>
    </form>
  );
}
