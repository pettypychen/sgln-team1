import {
  APAC_PILOT_PITCH_CONTENT,
  FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT,
  KOPI_RUN_CONTENT,
  MONTH_END_CLOSE_CONTENT,
} from "@/content/simulations";
import { resolveSourceArtifact } from "./sourceArtifactResolver";

export interface SourceArtifact {
  id: string;
  label: string;
  content: string;
}

const SOURCE_ARTIFACTS: Record<string, SourceArtifact[]> = {
  "first-year-associate-ma-due-diligence": [
    {
      id: "agreement-packet.md",
      label: "Agreement packet",
      content: FIRST_YEAR_ASSOCIATE_MA_DUE_DILIGENCE_CONTENT.caseMarkdown,
    },
  ],
  [MONTH_END_CLOSE_CONTENT.id]: MONTH_END_CLOSE_CONTENT.artifacts,
  [KOPI_RUN_CONTENT.id]: KOPI_RUN_CONTENT.artifacts,
  [APAC_PILOT_PITCH_CONTENT.id]: APAC_PILOT_PITCH_CONTENT.artifacts,
};

export function sourceArtifact(
  caseId: string,
  artifactId: string,
): SourceArtifact | null {
  const artifacts = SOURCE_ARTIFACTS[caseId] ?? [];
  return resolveSourceArtifact(artifacts, caseId, artifactId);
}
