import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  IS_PRELAUNCH,
  LOCKED_BY_TESTER,
  TESTER_EVENT,
  UNLOCKED_BY_TESTER,
  passkeyAccepted,
  previewInLink,
  readTesterState,
  testerUnlocked,
  writeTesterState,
} from "@/lib/prelaunch";

/**
 * The pre-launch gate for one browser session: whether it is unlocked, and the three ways to change that. Signed-in
 * members are unlocked by definition, so the workspace never meets a lock it can't clear.
 */
export function usePrelaunchGuard() {
  // Read in an effect, not during render: the server has no sessionStorage, so a lazy read would break the first paint.
  const [stored, setStored] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (!IS_PRELAUNCH) return;
    // A tester link unlocks the moment it lands, and stays unlocked for the session across redirects.
    if (previewInLink(window.location.search)) {
      writeTesterState(UNLOCKED_BY_TESTER);
      setStored(UNLOCKED_BY_TESTER);
    } else {
      setStored(readTesterState());
    }
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    // Another part of the page (the passkey on the sign-up card, the banner's Lock) changes the state this hook holds.
    const sync = () => setStored(readTesterState());
    window.addEventListener(TESTER_EVENT, sync);
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
      window.removeEventListener(TESTER_EVENT, sync);
    };
  }, []);

  const unlock = useCallback(() => {
    writeTesterState(UNLOCKED_BY_TESTER);
    setStored(UNLOCKED_BY_TESTER);
  }, []);

  /** The banner's Lock: show this browser the public view again, session or not. */
  const lock = useCallback(() => {
    writeTesterState(LOCKED_BY_TESTER);
    setStored(LOCKED_BY_TESTER);
  }, []);

  const tryPasskey = useCallback(
    (value: string) => {
      if (!passkeyAccepted(value)) return false;
      unlock();
      return true;
    },
    [unlock],
  );

  const unlocked = !IS_PRELAUNCH || testerUnlocked(stored, signedIn);
  return { isPrelaunch: IS_PRELAUNCH, unlocked, locked: !unlocked, signedIn, unlock, lock, tryPasskey };
}
