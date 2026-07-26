import caseMarkdown from "./case.md?raw";
import evaluationMarkdown from "./evaluation.md?raw";
import generalLedger from "./general-ledger.csv?raw";
import closeChecklist from "./close-checklist.csv?raw";
import managerNotes from "./manager-notes.md?raw";

export const MONTH_END_CLOSE_CONTENT = {
  id: "month-end-close-under-pressure",
  title: "Month-End Close Under Pressure",
  category: "Accounting",
  caseMarkdown,
  evaluationMarkdown,
  artifacts: [
    { id: "general-ledger.csv", label: "General ledger", content: generalLedger },
    { id: "close-checklist.csv", label: "Close checklist", content: closeChecklist },
    { id: "manager-notes.md", label: "Manager notes", content: managerNotes },
  ],
};
