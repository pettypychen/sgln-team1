import caseMarkdown from "./case.md?raw";
import evaluationMarkdown from "./evaluation.md?raw";
import framework from "./five-percent-zone.md?raw";
import visibilityRecord from "./visibility-record.md?raw";
import sevenWeeks from "./seven-weeks.md?raw";

export const THE_ROOM_YOURE_NOT_IN_CONTENT = {
  id: "the-room-youre-not-in",
  title: "The Room You're Not In",
  category: "Leadership",
  caseMarkdown,
  evaluationMarkdown,
  artifacts: [
    { id: "visibility-record.md", label: "Visibility record", content: visibilityRecord },
    { id: "seven-weeks.md", label: "The next seven weeks", content: sevenWeeks },
    { id: "five-percent-zone.md", label: "The 5% Zone (Adapted)", content: framework },
  ],
};
