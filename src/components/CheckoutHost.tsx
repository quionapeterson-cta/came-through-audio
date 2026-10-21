import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

let show: ((clientSecret: string) => void) | undefined;

/** Shows Stripe's payment form in a dialog. Returns false if the host isn't mounted. */
export function showCheckout(clientSecret: string): boolean {
  if (!show) return false;
  show(clientSecret);
  return true;
}

/** Mounted once in the root layout, like ConfirmHost. */
export function CheckoutHost() {
  const [secret, setSecret] = useState<string>();
  useEffect(() => { show = setSecret; return () => { show = undefined; }; }, []);
  return (
    <Dialog open={!!secret} onOpenChange={(o) => { if (!o) setSecret(undefined); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>Payments are processed securely by Stripe. Your card details never touch our servers.</DialogDescription>
        </DialogHeader>
        {secret && <StripeEmbeddedCheckout key={secret} clientSecret={secret} />}
      </DialogContent>
    </Dialog>
  );
}
