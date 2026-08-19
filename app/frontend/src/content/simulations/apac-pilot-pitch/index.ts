import caseMarkdown from "./case.md?raw";
import evaluationMarkdown from "./evaluation.md?raw";
import cultureMap from "./culture-map.md?raw";
import profile from "./jordan-whitaker-profile.md?raw";

export const APAC_PILOT_PITCH_CONTENT = {
  id: "apac-pilot-pitch",
  title: "Pitching the APAC pilot",
  category: "Business Analyst",
  caseMarkdown,
  evaluationMarkdown,
  artifacts: [
    { id: "culture-map.md", label: "Culture Map (Adapted)", content: cultureMap },
    { id: "jordan-whitaker-profile.md", label: "Jordan Whitaker profile", content: profile },
  ],
};
