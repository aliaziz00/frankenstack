interface ConceptTagsProps {
  concepts: string[];
}

// The row of concept tags shown on each lab card and at the top of a lab
// page. Styling is the global `.tags` rule in App.css.
export default function ConceptTags({ concepts }: ConceptTagsProps) {
  return (
    // Without a label a screen reader announces an anonymous list of items.
    <ul className="tags" aria-label="Concepts covered">
      {concepts.map((concept) => (
        <li key={concept}>{concept}</li>
      ))}
    </ul>
  );
}
