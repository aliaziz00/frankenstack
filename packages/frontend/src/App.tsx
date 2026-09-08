import { useEffect, useState, type FormEvent } from "react";
import { BACKEND_ORIGIN, createShortLink, listShortLinks, type ShortLink } from "./api";
import "./App.css";

export default function App() {
  const [longUrl, setLongUrl] = useState("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listShortLinks()
      .then(setLinks)
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createShortLink(longUrl);
      setLinks((prev) => [created, ...prev]);
      setLongUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <header>
        <h1>🧟 frankenstack</h1>
        <p className="subtitle">
          A personal system-design lab. First limb: a URL shortener.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="shorten-form">
        <input
          type="url"
          required
          placeholder="https://example.com/some/very/long/path"
          value={longUrl}
          onChange={(e) => setLongUrl(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Shortening…" : "Shorten"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <ul className="link-list">
        {links.map((link) => (
          <li key={link.shortCode}>
            <a href={`${BACKEND_ORIGIN}/${link.shortCode}`} target="_blank" rel="noreferrer">
              /{link.shortCode}
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
