import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { MA_DUE_DILIGENCE_MODULE } from "@/data/moduleWorkspace";
import { db } from "@/lib/firebase";
import type { ModuleWorkspace } from "@/types";

interface UseSimulationResult {
  module: ModuleWorkspace | null;
  loading: boolean;
  error: string | null;
}

export function useSimulation(slug: string): UseSimulationResult {
  const [module, setModule] = useState<ModuleWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!slug) {
      setModule(null);
      setError("Simulation not found.");
      setLoading(false);
      return;
    }

    if (!db) {
      const localModule =
        slug === MA_DUE_DILIGENCE_MODULE.id ? MA_DUE_DILIGENCE_MODULE : null;
      setModule(localModule);
      setError(localModule ? null : "Simulation not found.");
      setLoading(false);
      return;
    }

    getDoc(doc(db, "simulations", slug))
      .then((snapshot) => {
        if (snapshot.exists()) {
          setModule(snapshot.data() as ModuleWorkspace);
        } else {
          setError("Simulation not found.");
        }
      })
      .catch(() => setError("Failed to load simulation. Please try again."))
      .finally(() => setLoading(false));
  }, [slug]);

  return { module, loading, error };
}
