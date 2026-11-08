import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { clearCopiesAndReload } from "@/lib/qc";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {(error instanceof Error ? error.message : String(error ?? "")) || "An unexpected error occurred. Try reloading the page."}
      </p>
      <button type="button" className="min-h-12 w-full max-w-xs rounded-full bg-lime-300 px-6 font-bold text-zinc-900" onClick={() => location.reload()}>
        Restart
      </button>
      <button type="button" className="min-h-12 w-full max-w-xs rounded-full border border-zinc-500 px-6 font-semibold" onClick={() => clearCopiesAndReload()}>
        Restart with a fresh copy
      </button>
    </main>
  );
}
