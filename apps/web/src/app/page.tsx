import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-semibold tracking-tight">SWARM</h1>
        <p className="text-lg text-zinc-600">
          Asynchronous parallel agents that handle the busywork of being a student.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-md border border-zinc-300 text-sm font-medium hover:bg-zinc-100"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}