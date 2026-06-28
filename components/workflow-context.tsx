"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type WorkflowContextState = {
  course?: {
    id: string;
    title: string;
    href?: string;
  } | null;
  workspace?: {
    id: string;
    title: string;
    href: string;
  } | null;
  workshop?: {
    id: string;
    title: string;
    href: string;
  } | null;
  workshops: Array<{
    id: string;
    title: string;
    href: string;
    active?: boolean;
    units?: Array<{
      id: string;
      title: string;
      label: string;
      href: string;
      active?: boolean;
    }>;
  }>;
  units: Array<{
    id: string;
    title: string;
    label: string;
    href: string;
    active?: boolean;
  }>;
};

type WorkflowContextValue = {
  state: WorkflowContextState;
  updateWorkflowContext: (next: Partial<WorkflowContextState>) => void;
  resetWorkflowContext: () => void;
};

const STORAGE_KEY = "mi-workflow-context-v1";
const emptyWorkflowContext: WorkflowContextState = {
  course: null,
  workspace: null,
  workshop: null,
  workshops: [],
  units: []
};

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowContextProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WorkflowContextState>(emptyWorkflowContext);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setState({ ...emptyWorkflowContext, ...JSON.parse(stored) });
      }
    } catch {
      setState(emptyWorkflowContext);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const updateWorkflowContext = useCallback((next: Partial<WorkflowContextState>) => {
    setState((previous) => ({ ...previous, ...next }));
  }, []);

  const resetWorkflowContext = useCallback(() => {
    setState(emptyWorkflowContext);
  }, []);

  const value = useMemo(
    () => ({ state, updateWorkflowContext, resetWorkflowContext }),
    [resetWorkflowContext, state, updateWorkflowContext]
  );

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflowContext() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflowContext must be used inside WorkflowContextProvider.");
  }
  return context;
}
