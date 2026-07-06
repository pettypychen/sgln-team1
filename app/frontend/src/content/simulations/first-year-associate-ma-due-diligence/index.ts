import caseMarkdown from "./case.md?raw";
import evaluationMarkdown from "./evaluation.md?raw";

export const FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT = {
  slug: "first-year-associate-ma-due-diligence",
  title: "First-Year Associate: M&A Due Diligence",
  category: "LEGAL",
  role: "Junior clerk",
  difficulty: "Beginner",
  estimatedMinutes: 45,
  caseMarkdown,
  evaluationMarkdown,
} as const;
