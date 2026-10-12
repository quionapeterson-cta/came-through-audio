import { resolvePaddlePrice } from "@/lib/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let ready: Promise<void> | null = null;
export function initializePaddle() {
  if (ready) return ready;
  if (!clientToken) throw new Error("Payments are not configured");
  ready = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
      window.Paddle.Initialize({ token: clientToken });
      resolve();
    };
    script.onerror = () => { ready = null; reject(new Error("Could not load checkout")); };
    document.head.appendChild(script);
  });
  return ready;
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}

/** Opens the Paddle overlay. Items use our human-readable price IDs. */
export async function openCheckout(opts: {
  items: { priceId: string; quantity: number }[];
  email?: string | undefined;
  customData: Record<string, string>;
  successUrl?: string;
}) {
  await initializePaddle();
  const items = await Promise.all(opts.items.map(async (i) => ({ priceId: await getPaddlePriceId(i.priceId), quantity: i.quantity })));
  window.Paddle.Checkout.open({
    items,
    customer: opts.email ? { email: opts.email } : undefined,
    customData: opts.customData,
    settings: {
      displayMode: "overlay",
      successUrl: opts.successUrl ?? `${window.location.origin}/workspace?checkout=success`,
      allowLogout: false,
      variant: "one-page",
    },
  });
}
