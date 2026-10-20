import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Ask = { title: string; text?: string | undefined; action?: string | undefined; resolve: (ok: boolean) => void };
let show: ((a: Ask) => void) | undefined;

/**
 * The branded "Are you sure?" dialog, replacing the browser's plain pop-up everywhere.
 * `if (!(await confirmAction({ title: "Delete this song?" }))) return;` Falls back to the browser pop-up only if the
 * host isn't mounted.
 */
export function confirmAction(o: { title: string; text?: string; action?: string }): Promise<boolean> {
  if (!show) return Promise.resolve(typeof window !== "undefined" && window.confirm(o.title));
  return new Promise((resolve) => show!({ ...o, resolve }));
}

/** Mounted once in the root layout. */
export function ConfirmHost() {
  const [ask, setAsk] = useState<Ask>();
  useEffect(() => { show = setAsk; return () => { show = undefined; }; }, []);
  const close = (ok: boolean) => { ask?.resolve(ok); setAsk(undefined); };
  return (
    <AlertDialog open={!!ask} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
          {ask?.text && <AlertDialogDescription>{ask.text}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => close(true)}>{ask?.action ?? "Delete"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
