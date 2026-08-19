import caseMarkdown from "./case.md?raw";
import evaluationMarkdown from "./evaluation.md?raw";
import cultureMap from "./culture-map.md?raw";
import profile from "./rohan-krishnan-profile.md?raw";

export const MISSED_HANDOFF_CONTENT = {
  id: "missed-handoff-conversation",
  title: "The missed handoff",
  category: "Business Analyst",
  caseMarkdown,
  evaluationMarkdown,
  artifacts: [
    { id: "culture-map.md", label: "Culture Map (Adapted)", content: cultureMap },
    { id: "rohan-krishnan-profile.md", label: "Rohan Krishnan profile", content: profile },
  ],
};
