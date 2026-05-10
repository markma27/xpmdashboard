/**
 * Lightweight API route timing for development diagnostics (no row payloads).
 */
export function logApiPerf(routeName: string, startedAt: number): void {
  const ms = Math.round(performance.now() - startedAt)
  console.info('[perf]', routeName, ms, 'ms')
}
