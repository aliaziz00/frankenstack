import { useState, type FormEvent } from "react";
import { useShortLinks } from "./useShortLinks";

export default function Demo() {
  const [longUrl, setLongUrl] = useState("");
  const { links, loading, error, submitting, create } = useShortLinks();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (await create(longUrl)) setLongUrl("");
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
        {loading && <li className="empty">Loading…</li>}
        {!loading && links.length === 0 && !error && (
          <li className="empty">No links yet.</li>
        )}
      </ul>
    </div>
  );
}
