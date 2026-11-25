import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    // A failed first read (offline, a blip on the way to the auth server) must still end the wait: without this the
    // flag stayed true and every page that gates on it sat on "Loading…" until the tab was reloaded. The listener above
    // still signs the member in the moment a session arrives.
    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
