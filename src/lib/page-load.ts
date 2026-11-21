/** Safari reports interrupted fetches as "Load failed", including during preview updates. */
export function isPageLoadError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?|Importing a module script failed\.?|Failed to fetch dynamically imported module:.*|error loading dynamically imported module:.*)$/i.test(
      error.message,
    )
  );
}

/** Only retry this read: never fabricate an unlocked result or repeat a sign-in/write. */
export async function readGateWithRetry<T>(read: () => Promise<T>): Promise<T> {
  const delays = [250, 750];
  for (let attempt = 0; ; attempt++) {
    try {
      return await read();
    } catch (error) {
      const delay = delays[attempt];
      if (!isPageLoadError(error) || delay === undefined) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
}
