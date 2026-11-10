import { useEffect, useState, type FormEvent } from "react";
import { createShortLink, listShortLinks, type ShortLink } from "./api";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export default function Demo() {
  const [longUrl, setLongUrl] = useState("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listShortLinks()
      .then(setLinks)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createShortLink(longUrl);
      setLinks((prev) => [created, ...prev]);
      setLongUrl("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="shorten-form">
        <input
          type="url"
          required
          aria-label="Long URL to shorten"
          placeholder="https://example.com/some/very/long/path"
          value={longUrl}
          onChange={(event) => setLongUrl(event.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Shortening…" : "Shorten"}
        </button>
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <ul className="link-list">
        {links.map((link) => (
          <li key={link.shortCode}>
            <a href={`/s/${link.shortCode}`} target="_blank" rel="noreferrer">
              /s/{link.shortCode}
            </a>
            <span className="long-url" title={link.longUrl}>
              {link.longUrl}
            </span>
            <span className="clicks">{link.clickCount} clicks</span>
          </li>
        ))}
        {links.length === 0 && !error && <li className="empty">No links yet.</li>}
      </ul>
    </div>
  );
}
