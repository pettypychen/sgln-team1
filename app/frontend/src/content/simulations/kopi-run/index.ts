import caseMarkdown from "./case.md?raw";
import evaluationMarkdown from "./evaluation.md?raw";
import menu from "./kopi-menu.csv?raw";
import orders from "./colleague-orders.csv?raw";
import glossary from "./kopi-glossary.md?raw";

export const KOPI_RUN_CONTENT = {
  id: "kopi-run",
  title: "Kopi Run",
  category: "Onboarding",
  caseMarkdown,
  evaluationMarkdown,
  artifacts: [
    { id: "kopi-menu.csv", label: "Kopi menu", content: menu },
    { id: "colleague-orders.csv", label: "Colleague orders", content: orders },
    { id: "kopi-glossary.md", label: "Kopi glossary", content: glossary },
  ],
};
