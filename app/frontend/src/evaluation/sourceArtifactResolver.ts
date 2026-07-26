export interface IdentifiedArtifact {
  id: string;
}

export function resolveSourceArtifact<T extends IdentifiedArtifact>(
  artifacts: readonly T[],
  caseId: string,
  artifactId: string,
): T | null {
  const exact = artifacts.find((artifact) => artifact.id === artifactId);
  if (exact) return exact;

  // Immutable attempts created before artifact filenames were introduced used
  // one case-level packet ID. Keep those historical citations reviewable.
  if (artifactId === `${caseId}-packet` && artifacts.length === 1) {
    return artifacts[0];
  }
  return null;
}
