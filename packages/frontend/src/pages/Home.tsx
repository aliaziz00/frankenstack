import { Link } from "react-router-dom";
import { labs } from "../labs/registry";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Systems I've built to learn system design</h1>
        <p>
          Each lab is a small, working system with a live demo, the requirements it was built
          against, the trade-offs I chose, and where it breaks first.
        </p>
      </section>

      <section className="lab-grid">
        {labs.map((lab) => (
          <Link key={lab.slug} to={`/labs/${lab.slug}`} className="lab-card">
            <div className="lab-card-head">
              <h2>{lab.title}</h2>
              <span className={`badge ${lab.status}`}>{lab.status}</span>
            </div>
            <p>{lab.summary}</p>
            <ul className="tags">
              {lab.concepts.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
          </Link>
        ))}
      </section>
    </>
  );
}
