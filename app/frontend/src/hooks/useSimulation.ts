import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
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
    if (!slug) return;
    setLoading(true);
    setError(null);

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
