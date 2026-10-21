const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

/** Test mode in the preview (Stripe pk_test_ key), live on the published site. Same answer in the browser and server. */
export function getPaymentsEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("pk_live_") ? "live" : "sandbox";
}
