import type { ComponentType, LazyExoticComponent } from "react";

export interface DesignDecision {
  title: string;
  body: string;
}

// One entry per system. Adding a lab = a new folder under src/labs plus one
// entry in registry.ts; the Home and LabPage views render from this data.
export interface Lab {
  slug: string;
  title: string;
  summary: string;
  status: "live" | "planned";
  concepts: string[];
  // Absent while a lab is only planned.
  Demo?: LazyExoticComponent<ComponentType>;
  design: {
    problem: string;
    requirements: string[];
    decisions: DesignDecision[];
    // What breaks first, and what the next version would change.
    limits: string[];
  };
}
