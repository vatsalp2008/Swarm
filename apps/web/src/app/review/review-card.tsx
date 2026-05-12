'use client';

import { useState, useTransition } from 'react';
import { ResearchBeeOutput } from '@swarm/shared';
import { approveReview, denyReview } from './actions';

interface Props {
  reviewId: string;
  taskId: string;
  prompt: string;
  beeType: string;
  proposal: unknown;
  createdAt: string;
}

export function ReviewCard(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  function handle(decision: 'approve' | 'deny') {
    setError(null);
    startTransition(async () => {
      const res =
        decision === 'approve'
          ? await approveReview(props.reviewId)
          : await denyReview(props.reviewId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHidden(true);
    });
  }

  return (
    <article className="border border-zinc-200 rounded-lg p-5 bg-white">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">
            {props.beeType} bee · {new Date(props.createdAt).toLocaleString()}
          </p>
          <p className="text-base font-medium text-zinc-900 mt-1 truncate">{props.prompt}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handle('deny')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            {pending ? '…' : 'Deny'}
          </button>
          <button
            type="button"
            onClick={() => handle('approve')}
            disabled={pending}
            className="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-sm hover:bg-zinc-800 disabled:opacity-50"
          >
            {pending ? '…' : 'Approve'}
          </button>
        </div>
      </header>

      <ProposalBody beeType={props.beeType} proposal={props.proposal} />

      {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
    </article>
  );
}

function ProposalBody({ beeType, proposal }: { beeType: string; proposal: unknown }) {
  if (beeType === 'research') {
    const parsed = ResearchBeeOutput.safeParse(proposal);
    if (!parsed.success) {
      return <RawJson value={proposal} />;
    }
    return <ResearchResults data={parsed.data} />;
  }
  return <RawJson value={proposal} />;
}

function ResearchResults({ data }: { data: import('@swarm/shared').ResearchBeeOutput }) {
  if (data.results.length === 0) {
    return <p className="text-sm text-zinc-600">{data.notes ?? 'No results.'}</p>;
  }
  return (
    <ul className="space-y-2">
      {data.results.map((r, i) => (
        <li key={i} className="text-sm border-l-2 border-zinc-200 pl-3">
          <a
            href={r.url}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-zinc-900 hover:underline"
          >
            {r.title}
          </a>
          <span className="text-zinc-600"> · {r.company}</span>
          {r.location ? <span className="text-zinc-500"> · {r.location}</span> : null}
          <span className="block text-xs text-zinc-400">{r.source}</span>
        </li>
      ))}
    </ul>
  );
}

function RawJson({ value }: { value: unknown }) {
  return (
    <pre className="text-xs bg-zinc-50 border border-zinc-200 rounded p-3 overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
