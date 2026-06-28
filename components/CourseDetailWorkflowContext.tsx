"use client";

import { useEffect } from "react";

import { useWorkflowContext } from "@/components/workflow-context";

type CourseDetailWorkflowContextProps = {
  course: {
    id: string;
    title: string;
    href: string;
  };
  workspace: {
    id: string;
    title: string;
    href: string;
  } | null;
  workshops: Array<{
    id: string;
    title: string;
    href: string;
    units?: Array<{
      id: string;
      title: string;
      label: string;
      href: string;
    }>;
  }>;
};

export function CourseDetailWorkflowContext({ course, workspace, workshops }: CourseDetailWorkflowContextProps) {
  const { updateWorkflowContext } = useWorkflowContext();

  useEffect(() => {
    updateWorkflowContext({
      course,
      workspace,
      workshop: null,
      workshops,
      units: []
    });
  }, [course, updateWorkflowContext, workspace, workshops]);

  return null;
}
