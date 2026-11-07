import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { findLab } from "../labs/registry";

export default function LabPage() {
  const { slug } = useParams();
  const lab = findLab(slug);

  if (!lab) {
    return (
      <section>
        <h1>Lab not found</h1>
        <Link to="/">Back to all labs</Link>
      </section>
    );
  }

  const { Demo, design } = lab;

  return (
    <article className="lab-page">
      <Link to="/" className="back">
        ← All labs
      </Link>
      <header>
        <h1>{lab.title}</h1>
        <p className="subtitle">{lab.summary}</p>
        <ul className="tags">
          {lab.concepts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </header>

      <section>
        <h2>Demo</h2>
        {Demo ? (
          <Suspense fallback={<p className="muted">Loading demo…</p>}>
            <Demo />
          </Suspense>
        ) : (
          <p className="muted">Not built yet. The design below is the plan.</p>
        )}
      </section>

      <section>
        <h2>Problem</h2>
        <p>{design.problem}</p>
        <h3>Requirements</h3>
        <ul>
          {design.requirements.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Design decisions</h2>
        {design.decisions.map((d) => (
          <div key={d.title} className="decision">
            <h3>{d.title}</h3>
            <p>{d.body}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Where it breaks</h2>
        <ul>
          {design.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
