import { useEffect, useState } from "react";
import { createShortLink, listShortLinks, type ShortLink } from "./api";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

// Everything the demo needs from the API: the list of links, whether the
// first load is still in flight, the latest error, and a way to create one.
// Demo.tsx only renders; this hook owns the data.
export function useShortLinks() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // True until the first response (or error) arrives. Without it the empty
  // list looks identical to "nothing loaded yet" and the page briefly claims
  // "No links yet." while the request is still in flight.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cancel the request if the component unmounts first (and in development,
    // where React StrictMode runs this effect twice, the first run).
    const controller = new AbortController();
    listShortLinks(controller.signal)
      .then((loaded) => {
        setLinks(loaded);
        setLoading(false);
      })
      .catch((err) => {
        // Aborting rejects with an AbortError. That is us cancelling on
        // purpose, not a failure to show the user. Do not clear `loading`
        // here either: under StrictMode another request is already in flight.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(errorMessage(err));
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Resolves to true if the link was created, so the caller knows whether to
  // clear its input; on failure the error is stored in `error`.
  async function create(longUrl: string): Promise<boolean> {
    setError(null);
    setSubmitting(true);
    try {
      const created = await createShortLink(longUrl);
      setLinks((prev) => [created, ...prev]);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { links, loading, error, submitting, create };
}
