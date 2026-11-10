import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary";
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
        <span aria-hidden="true">←</span> All labs
      </Link>
      <header>
        <h1>{lab.title}</h1>
        <p className="subtitle">{lab.summary}</p>
        <ul className="tags">
          {lab.concepts.map((concept) => (
            <li key={concept}>{concept}</li>
          ))}
        </ul>
      </header>

      <section>
        <h2>Demo</h2>
        {/* The boundary sits outside Suspense so it also catches a lazy()
            chunk that fails to load. A crash in the demo leaves the design
            write-up below intact. */}
        {Demo ? (
          <ErrorBoundary label="This demo">
            <Suspense fallback={<p className="muted">Loading demo…</p>}>
              <Demo />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <p className="muted">Not built yet. The design below is the plan.</p>
        )}
      </section>

      <section>
        <h2>Problem</h2>
        <p>{design.problem}</p>
        <h3>Requirements</h3>
        <ul>
          {design.requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Design decisions</h2>
        {design.decisions.map((decision) => (
          <div key={decision.title} className="decision">
            <h3>{decision.title}</h3>
            <p>{decision.body}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Where it breaks</h2>
        <ul>
          {design.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
