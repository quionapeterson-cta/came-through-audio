import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSupportScripts } from "@/lib/support-scripts.functions";
import type { SupportScript } from "@/lib/support-scripts";

/**
 * The staff script catalog, fetched once per session. The words are server-side (`support-scripts.server.ts`) so they no
 * longer ship in the admin bundle; this is the only way the panel and the ticket rail get them.
 */
export function useSupportScripts(): { scripts: SupportScript[]; loading: boolean; error: boolean } {
  const load = useServerFn(listSupportScripts);
  const q = useQuery({
    queryKey: ["support-scripts"],
    queryFn: () => load(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return { scripts: q.data ?? [], loading: q.isLoading, error: q.isError };
}
