import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

/** Adds the signed-in user's access token to server function calls. */
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
