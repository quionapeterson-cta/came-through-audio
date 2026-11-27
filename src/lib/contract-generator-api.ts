/**
 * Contract Generator, front end (founder, 2026-11-27).
 *
 * The full contract is drafted by the dedicated Cloudflare Worker (`workers/cta-contract-generator.js`) through
 * Workers AI. The app calls it directly from the browser with `VITE_CTA_CONTRACT_WORKER_URL`; when that variable is
 * unset the deployed Worker's own URL below is used, so the button works on a build that has not been configured yet.
 *
 * Every failure is surfaced with the status and the Worker's own words, so a wrong URL, a CORS refusal, a rate limit or
 * an AI error is visible instead of looking like a dead button.
 */

/** The deployed Worker. Override with VITE_CTA_CONTRACT_WORKER_URL when the Worker moves. */
export const CONTRACT_WORKER_URL = "https://cta-contract-generator.quionapeterson.workers.dev";

/** How long a draft may take before the browser gives up (Workers AI can think for a while). */
export const CONTRACT_TIMEOUT_MS = 90_000;

export function contractWorkerUrl(): string {
  const configured = import.meta.env["VITE_CTA_CONTRACT_WORKER_URL"] as string | undefined;
  return ((configured ?? "").trim() || CONTRACT_WORKER_URL).replace(/\/+$/, "");
}

/** A failed call, with what the Worker answered so the screen can show it. */
export class ContractWorkerError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: string,
    /** The Worker's own code for this failure; "daily_limit" means today's free drafting allowance is spent. */
    public code?: string,
  ) {
    super(message);
    this.name = "ContractWorkerError";
  }
}

export type GeneratedContract = { contract: string; title: string; model?: string | undefined };

type WorkerBody = {
  contract?: unknown;
  title?: unknown;
  model?: unknown;
  error?: unknown;
  detail?: unknown;
  code?: unknown;
};

/**
 * POST the scenario to the Worker and return the contract document.
 * Throws ContractWorkerError with the status and the Worker's message whenever the answer is not a contract.
 */
export async function generateContractDocument(
  input: { scenario: string; company?: boolean; paid?: boolean },
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<GeneratedContract> {
  const url = contractWorkerUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? CONTRACT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenario: input.scenario,
          company: input.company === true,
          paid: input.paid === true,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      const aborted = controller.signal.aborted;
      throw new ContractWorkerError(
        aborted
          ? "The generator took too long. Try again in a moment."
          : "The generator couldn't be reached. Check your connection and try again.",
        undefined,
        `${url} — ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const body = (await res.json().catch(() => null)) as WorkerBody | null;
    if (!res.ok) {
      // Out of today's free Workers AI allowance (Cloudflare error 4006: "you have used up your daily free allocation
      // of 10,000 neurons"). That is a busy day, not a fault: say so and let the page offer the closest premade
      // contracts instead of a dead end.
      const outOfAllowance =
        body?.code === "daily_limit" ||
        /4006|daily free allocation|used up your daily free/i.test(
          typeof body?.detail === "string" ? body.detail : "",
        );
      if (outOfAllowance) {
        throw new ContractWorkerError(
          "We're experiencing high volume right now. Try again tomorrow.",
          res.status,
          typeof body?.detail === "string" ? body.detail : undefined,
          "daily_limit",
        );
      }
      const reason =
        typeof body?.error === "string" && body.error.trim()
          ? body.error.trim()
          : res.status === 403
            ? "This site isn't allowed to call the generator (origin refused)."
            : `The generator answered ${res.status}.`;
      throw new ContractWorkerError(
        reason,
        res.status,
        typeof body?.detail === "string" ? body.detail : undefined,
        typeof body?.code === "string" ? body.code : undefined,
      );
    }

    const contract = typeof body?.contract === "string" ? body.contract.trim() : "";
    if (!contract) {
      throw new ContractWorkerError(
        "The generator returned no contract. Try again.",
        res.status,
        body ? JSON.stringify(body).slice(0, 400) : undefined,
      );
    }
    return {
      contract,
      title: typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Contract",
      model: typeof body?.model === "string" ? body.model : undefined,
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/** A filename for the downloaded document, from the contract's title. */
export function contractFileName(title: string): string {
  const slug = (title || "contract")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "contract"}.txt`;
}
