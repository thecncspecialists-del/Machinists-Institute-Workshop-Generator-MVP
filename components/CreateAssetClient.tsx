"use client";

import { useMemo, useState } from "react";
import { Link2, RefreshCw, RotateCcw, Unlink } from "lucide-react";
import { ReferencePanel, type CourseReference } from "@/components/ReferencePanel";
import { OutputTabs } from "@/components/OutputTabs";
import {
  activeAssetTypes,
  assetTypes,
  CurriculumInput,
  editableInputFields,
  type ActiveAssetType,
  type AssetStatus,
  type AssetType
} from "@/lib/constants";
import {
  activitySectionTemplate,
  renderStructuredAsset,
  type StructuredAsset,
  validateAssetOutput,
  workshopSectionTemplate
} from "@/lib/renderAsset";

type Outcome = {
  outcomeCode: string | null;
  description: string;
};

type CourseContext = CourseReference & {
  id: string;
  outcomes: Outcome[];
};

type GeneratedOutput = {
  outputJson: StructuredAsset;
  richText: string;
  html: string;
};

const assignmentExampleInput: CurriculumInput = {
  topic: "Workshop 1 | PolyScope X e-Learning",
  audience: "Apprentices beginning collaborative robotics fundamentals.",
  learningOutcomes: [
    "Identify components, including the teach pendant, control box, robot arm, and end effector.",
    "Describe powering up, initializing, mounting a gripper, configuring tools, and saving programs.",
    "Recognize common robot movement types, tool center point concepts, and basic program structure."
  ].join("\n"),
  duration: "5 hrs",
  materials: [
    "Computer with internet access",
    "Universal Robots Academy account",
    "Tooling U assignments",
    "UR5 robot with gripper end effector"
  ].join("\n"),
  equipment: "UR5 robot with gripper end effector and PolyScope interface access.",
  preparationNotes: "Confirm e-learning links, verify robot safety setup, and stage instructor demo system.",
  instructorNotes:
    "Discuss startup, end-effector connection, setup, movement types, and basic programming concepts before lab walkthrough.",
  studentInstructions: [
    "Step 1: Complete both Tooling U lessons: Robot Installations and Network Integration for Robot Workcells.",
    "Step 2: Complete the assigned Universal Robots Academy PolyScope X e-Learning modules.",
    "Step 3: Attend the instructor-led workshop session and compare module concepts to the live PolyScope interface."
  ].join("\n"),
  assessment:
    "Instructor observation and notes during workshop walkthrough; no separate file upload unless assigned.",
  references: [
    "https://academy.universal-robots.com/free-e-learning/",
    "Tooling U | Robot Installations",
    "Tooling U | Network Integration for Robot Workcells"
  ].join("\n"),
  additionalConstraints:
    "Complete required e-learning modules and Tooling U lessons before or alongside in-person workshop session."
};

const questionGuidance: Record<string, { prompt: string; example: string; placeholder: string }> = {
  topic: {
    prompt: "What is the main workshop topic?",
    example: "Cobot startup, safety checks, and basic movement programming.",
    placeholder: "Write a one-sentence workshop focus."
  },
  audience: {
    prompt: "Who are the learners?",
    example: "First-year apprentices with little to no robotics experience.",
    placeholder: "Describe learner level, background, and any prerequisites."
  },
  learningOutcomes: {
    prompt: "What should learners be able to do at the end?",
    example: "Identify key controls, complete startup checklist, and jog the robot safely.",
    placeholder: "List outcomes, one per line."
  },
  duration: {
    prompt: "How long is this workshop?",
    example: "8 hours total: 2-hour e-learning + 6-hour instructor-led lab.",
    placeholder: "Include total time and optional breakdown."
  },
  materials: {
    prompt: "What materials do learners need?",
    example: "Startup checklist, Tooling U links, and printed safety SOP.",
    placeholder: "List handouts, modules, and links."
  },
  equipment: {
    prompt: "What equipment is required?",
    example: "UR5 with gripper, teach pendant, safety barriers, and demo fixture.",
    placeholder: "List lab equipment and setup requirements."
  },
  preparationNotes: {
    prompt: "What should be prepared before class?",
    example: "Verify firmware, test E-stop, stage fixtures, and print checklists.",
    placeholder: "Add pre-session preparation steps."
  },
  instructorNotes: {
    prompt: "What instructor coaching notes should be included?",
    example: "Pause after each demo step; ask learners to verbalize each safety check.",
    placeholder: "Add pacing cues, facilitation notes, and reminders."
  },
  studentInstructions: {
    prompt: "What should students do during the session?",
    example: "Complete modules, run checklist, then perform guided motion tasks.",
    placeholder: "Provide clear learner-facing instructions."
  },
  assessment: {
    prompt: "How will learning be assessed?",
    example: "Observation rubric + practical demonstration + short reflection.",
    placeholder: "Describe evidence of learning and pass criteria."
  },
  references: {
    prompt: "What references or links should be included?",
    example: "UR Academy module links, Canvas pages, and lab SOP docs.",
    placeholder: "Paste links and supporting references."
  },
  additionalConstraints: {
    prompt: "Any constraints or policy requirements?",
    example: "No live motion until safety quiz pass; PPE required at all times.",
    placeholder: "List requirements that must be enforced."
  }
};

export function CreateAssetClient({
  courses,
  initialCourseId,
  defaultContributor,
  contextWarning
}: {
  courses: CourseContext[];
  initialCourseId?: string | null;
  defaultContributor: string;
  contextWarning?: string | null;
}) {
  const [assetType, setAssetType] = useState<ActiveAssetType>("Workshop");
  const [input, setInput] = useState<CurriculumInput>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contributorName, setContributorName] = useState(defaultContributor);
  const [selectedProgram, setSelectedProgram] = useState("All Programs");
  const [contextQuery, setContextQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId ?? "");
  const [attachedCourseId, setAttachedCourseId] = useState(initialCourseId ?? "");
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [suggestionRefreshes, setSuggestionRefreshes] = useState<Partial<Record<keyof CurriculumInput, number>>>({});

  const programOptions = useMemo(() => {
    const programs = Array.from(new Set(courses.map((course) => inferProgram(course.courseCode))));
    return ["All Programs", ...programs.sort((a, b) => a.localeCompare(b))];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = contextQuery.trim().toLowerCase();
    const byProgram =
      selectedProgram === "All Programs"
        ? courses
        : courses.filter((course) => inferProgram(course.courseCode) === selectedProgram);
    const sorted = [...byProgram].sort((a, b) => {
      const aCode = a.courseCode ?? "";
      const bCode = b.courseCode ?? "";
      if (aCode !== bCode) return aCode.localeCompare(bCode);
      return a.courseName.localeCompare(b.courseName);
    });
    if (!query) return sorted.slice(0, 50);
    return sorted
      .filter((course) =>
        [course.courseCode, course.courseName, course.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 50);
  }, [contextQuery, courses, selectedProgram]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );
  const attachedCourse = useMemo(
    () => courses.find((course) => course.id === attachedCourseId) ?? null,
    [courses, attachedCourseId]
  );
  const output = useMemo(
    () =>
      createLiveOutput({
        assetType,
        input,
        attachedCourse
      }),
    [assetType, attachedCourse, input]
  );
  const activeField = editableInputFields[activeQuestionIndex];
  const guidance = questionGuidance[activeField.key] ?? {
    prompt: activeField.label,
    example: "",
    placeholder: ""
  };
  const activeValue = input[activeField.key] ?? "";
  const activeSuggestion = useMemo(
    () =>
      buildSuggestion(
        activeField.key,
        activeValue,
        guidance.example,
        suggestionRefreshes[activeField.key] ?? 0
      ),
    [activeField.key, activeValue, guidance.example, suggestionRefreshes]
  );
  const showSuggestion = Boolean(activeSuggestion) && activeValue.trim() !== activeSuggestion.trim();
  const completedCount = useMemo(
    () => editableInputFields.filter((field) => (input[field.key] ?? "").trim().length > 0).length,
    [input]
  );
  const progressPercent = Math.round((completedCount / editableInputFields.length) * 100);

  async function saveAsset(status: AssetStatus) {
    setBusy(true);
    setError(null);

    try {
      const createdBy = contributorName.trim();
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: attachedCourse?.id ?? null,
          assetType,
          title: output.outputJson.title,
          status,
          inputJson: input,
          outputJson: output.outputJson,
          richTextOutput: output.richText,
          htmlOutput: output.html,
          ...(createdBy ? { createdBy } : {})
        })
      });
      const data = await readJsonResponse<{ asset?: unknown }>(response);

      if (!response.ok) {
        setError(data.error || "Could not save asset.");
        return;
      }

      setSaved(true);
    } catch {
      setError("Could not reach the asset library. Check the dev server and try again.");
    } finally {
      setBusy(false);
    }
  }

  function acceptSuggestion() {
    setInput((current) => ({ ...current, [activeField.key]: activeSuggestion }));
    setSaved(false);
  }

  function refreshSuggestion() {
    setSuggestionRefreshes((current) => ({
      ...current,
      [activeField.key]: (current[activeField.key] ?? 0) + 1
    }));
  }

  return (
    <div className="split create-workspace">
      <section className="panel create-input-panel">
        <div className="composer-controls">
          <div className="field compact-field">
            <label className="sr-only" htmlFor="asset-type">Asset type</label>
            <select
              id="asset-type"
              value={assetType}
              onChange={(event) => {
                const nextAssetType = event.target.value as ActiveAssetType;
                setAssetType(nextAssetType);
                setSaved(false);
              }}
            >
              {assetTypes.map((type) => (
                <option key={type} value={type} disabled={!isActiveAssetType(type)}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="field compact-field">
            <label className="sr-only" htmlFor="contributor-name">Contributor label</label>
            <input
              id="contributor-name"
              value={contributorName}
              onChange={(event) => setContributorName(event.target.value)}
              placeholder="Curriculum developer or team"
            />
          </div>
        </div>

        <section className="interview-panel">
          <div className="question-meta">
            <span>Question {activeQuestionIndex + 1} of {editableInputFields.length}</span>
            <span>{completedCount}/{editableInputFields.length}</span>
          </div>
          <p className="question-prompt">{guidance.prompt}</p>
          <div className="progress-track" aria-hidden>
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="field question-field">
            <label className="sr-only" htmlFor={`question-${activeField.key}`}>{activeField.label}</label>
            {activeField.type === "textarea" ? (
              <textarea
                id={`question-${activeField.key}`}
                placeholder={guidance.placeholder}
                value={activeValue}
                onChange={(event) => setInput((current) => ({ ...current, [activeField.key]: event.target.value }))}
              />
            ) : (
              <input
                id={`question-${activeField.key}`}
                placeholder={guidance.placeholder}
                value={activeValue}
                onChange={(event) => setInput((current) => ({ ...current, [activeField.key]: event.target.value }))}
              />
            )}
          </div>

          {showSuggestion ? (
            <div className="suggestion-card">
              <div>
                <span className="suggestion-label">AI suggestion</span>
                <p>{activeSuggestion}</p>
              </div>
              <div className="suggestion-actions">
                <button
                  className="icon-btn suggestion-refresh"
                  type="button"
                  title="Refresh suggestion"
                  aria-label="Refresh suggestion"
                  onClick={refreshSuggestion}
                >
                  <RefreshCw size={16} aria-hidden />
                </button>
                <button className="btn primary" type="button" onClick={acceptSuggestion}>
                  Accept suggestion
                </button>
              </div>
            </div>
          ) : null}

          <div className="button-row compact-row question-actions">
            <button
              className="btn ghost"
              type="button"
              disabled={activeQuestionIndex === 0}
              onClick={() => setActiveQuestionIndex((index) => Math.max(0, index - 1))}
            >
              Back
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={activeQuestionIndex === editableInputFields.length - 1}
              onClick={() => setActiveQuestionIndex((index) => Math.min(editableInputFields.length - 1, index + 1))}
            >
              Next
            </button>
            <button className="btn ghost" type="button" onClick={() => setInput(assignmentExampleInput)}>
              Load assignment
            </button>
          </div>
        </section>

        <div className="button-row create-actions">
          <button
            className="btn ghost"
            onClick={() => {
              setInput({});
              setSuggestionRefreshes({});
              setSaved(false);
              setError(null);
            }}
            disabled={busy}
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
        {error ? <p className="warning">{error}</p> : null}

        <details className="context-panel minimalist" open>
          <summary>Course context</summary>
          {contextWarning ? <p className="warning">{contextWarning}</p> : null}
          <div className="field context-controls">
            <label className="sr-only" htmlFor="program-filter">Program filter</label>
            <select id="program-filter" value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)}>
              {programOptions.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="course-context-search">Course search</label>
            <input
              id="course-context-search"
              placeholder="Search by code, title, or description"
              value={contextQuery}
              onChange={(event) => setContextQuery(event.target.value)}
            />
            <div className="picker-list" role="listbox" aria-label="Course context options">
              <button
                type="button"
                className={`picker-item ${selectedCourseId === "" ? "active" : ""}`}
                onClick={() => setSelectedCourseId("")}
              >
                <strong>No course context attached</strong>
                <span>Teaching intent only.</span>
              </button>
              {filteredCourses.map((course) => (
                <button
                  type="button"
                  key={course.id}
                  className={`picker-item ${selectedCourseId === course.id ? "active" : ""}`}
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <strong>{course.courseCode ? `${course.courseCode} - ` : ""}{course.courseName}</strong>
                  <span>{course.outcomes.length} outcomes</span>
                </button>
              ))}
            </div>
          </div>
          <div className="button-row" style={{ marginTop: 10 }}>
            <button
              className="btn ghost"
              onClick={() => setAttachedCourseId(selectedCourseId)}
              disabled={!selectedCourseId || selectedCourseId === attachedCourseId}
              type="button"
            >
              <Link2 size={18} />
              Attach Context
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setAttachedCourseId("");
                setSelectedCourseId("");
              }}
              disabled={!attachedCourseId}
              type="button"
            >
              <Unlink size={18} />
              Detach Context
            </button>
          </div>
          {attachedCourse ? (
            <div className="context-summary">
              <span className="pill draft">Attached</span>
              <span>
                {attachedCourse.courseCode ? `${attachedCourse.courseCode} - ` : ""}
                {attachedCourse.courseName}
              </span>
            </div>
          ) : null}
          {attachedCourse ? (
            <div className="context-reference">
              <ReferencePanel course={attachedCourse} compact />
            </div>
          ) : null}
        </details>
      </section>

      <section className="panel preview-panel">
        <OutputTabs
          outputJson={output.outputJson}
          richText={output.richText}
          html={output.html}
          onSave={saveAsset}
          canSave
          saved={saved}
          saveDisabled={busy}
        />
      </section>
    </div>
  );
}

function inferProgram(courseCode: string | null) {
  const value = (courseCode ?? "").trim();
  if (!value) return "Uncategorized";
  const token = value.split(/\s+/)[0] ?? "";
  return token.replace(/[^A-Za-z]/g, "") || "Uncategorized";
}

function buildSuggestion(
  key: keyof CurriculumInput,
  rawInput: string,
  fallback: string,
  refreshIndex: number
) {
  const cleaned = collapseWhitespace(rawInput);
  if (!cleaned) return fallback;

  const phrase = stripTerminalPunctuation(cleaned);
  const lowerPhrase = lowerFirst(phrase);
  const variants: Partial<Record<keyof CurriculumInput, string[]>> = {
    topic: [
      ensureSentence(phrase),
      `Hands-on workshop focused on ${lowerPhrase}.`,
      `Practical session covering ${lowerPhrase}.`
    ],
    audience: [
      ensureSentence(phrase),
      `${ensureSentence(phrase)} Include enough support for guided hands-on practice.`,
      `Learners are ${lowerPhrase}, with scaffolding for safe practice.`
    ],
    learningOutcomes: [
      `Identify key concepts related to ${lowerPhrase}.\nApply the process during guided practice.\nExplain safety or quality checks before independent work.`,
      `By the end, learners can describe ${lowerPhrase}, perform the core steps, and reflect on results.`,
      ensureSentence(phrase)
    ],
    duration: [
      ensureSentence(phrase),
      `${ensureSentence(phrase)} Include time for setup, guided practice, and wrap-up.`,
      `${ensureSentence(phrase)} Reserve the final 10 minutes for questions and review.`
    ],
    materials: [
      ensureSentence(phrase),
      `${ensureSentence(phrase)} Prepare digital and printed copies before class.`,
      `Provide ${lowerPhrase}, plus any links learners need during the session.`
    ],
    equipment: [
      ensureSentence(phrase),
      `Use ${lowerPhrase}; verify setup and safety checks before learners begin.`,
      `${ensureSentence(phrase)} Confirm all equipment is staged and functional.`
    ],
    preparationNotes: [
      ensureSentence(phrase),
      `${ensureSentence(phrase)} Complete checks before learners arrive.`,
      `Before class, ${lowerPhrase}; document anything that affects timing or safety.`
    ],
    instructorNotes: [
      ensureSentence(phrase),
      `${ensureSentence(phrase)} Pause for learner questions before moving to independent practice.`,
      `Coach learners through ${lowerPhrase}, then ask them to explain the decision points.`
    ],
    studentInstructions: [
      ensureSentence(phrase),
      `Complete ${lowerPhrase}, then confirm your work with the instructor before moving on.`,
      `Follow the provided steps for ${lowerPhrase}; record questions or blockers as they come up.`
    ],
    assessment: [
      ensureSentence(phrase),
      `Assess through ${lowerPhrase}, plus instructor observation during practice.`,
      `Use ${lowerPhrase} as evidence that learners can perform the required skill.`
    ],
    references: [
      ensureSentence(phrase),
      `Include ${lowerPhrase} as supporting reference material.`,
      `Use ${lowerPhrase} for learner reference before and after the session.`
    ],
    additionalConstraints: [
      ensureSentence(phrase),
      `${ensureSentence(phrase)} Make this requirement visible before learners begin.`,
      `Enforce ${lowerPhrase} throughout the workshop.`
    ]
  };

  const options = variants[key] ?? [ensureSentence(phrase)];
  return options[refreshIndex % options.length];
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTerminalPunctuation(value: string) {
  return value.replace(/[.!?]+$/g, "").trim();
}

function ensureSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${/[.!?]$/.test(trimmed) ? "" : "."}`;
}

function lowerFirst(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function isActiveAssetType(type: AssetType | string): type is ActiveAssetType {
  return activeAssetTypes.includes(type as ActiveAssetType);
}

async function readJsonResponse<T>(response: Response): Promise<T & { error?: string }> {
  try {
    return (await response.json()) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}

function createLiveOutput(params: {
  assetType: ActiveAssetType;
  input: CurriculumInput;
  attachedCourse: CourseContext | null;
}): GeneratedOutput {
  const { assetType, input, attachedCourse } = params;
  const topic = collapseWhitespace(input.topic ?? "");
  const titleBase = topic || attachedCourse?.courseName || assetType;
  const title = `${attachedCourse?.courseCode ? `${attachedCourse.courseCode}: ` : ""}${titleBase} ${assetType}`.trim();

  const sectionTemplate = assetType === "Activity" ? activitySectionTemplate : workshopSectionTemplate;
  const sectionContent: Record<string, string | string[]> = {
    overview: topic ? `${ensureSentence(topic)} This draft updates as inputs change.` : "",
    course_context: formatCourseContext(attachedCourse),
    learning_outcomes: toLines(input.learningOutcomes),
    duration_and_timing: collapseWhitespace(input.duration ?? ""),
    materials_and_equipment: combineMaterialsAndEquipment(input.materials, input.equipment),
    preparation: toLines(input.preparationNotes),
    facilitation_plan: toLines(input.instructorNotes),
    student_instructions: toLines(input.studentInstructions),
    activity_steps: toLines(input.studentInstructions),
    discussion_or_reflection: toLines(input.additionalConstraints),
    practice_checks: toLines(input.additionalConstraints),
    assessment: toLines(input.assessment),
    references: toLines(input.references),
    review_notes: "Live draft preview. Human review required before use."
  };

  const normalized = validateAssetOutput(
    {
      title,
      sections: sectionTemplate.map((section) => ({
        id: section.id,
        content: sectionContent[section.id] ?? ""
      }))
    },
    assetType,
    title
  );
  const rendered = renderStructuredAsset(normalized);
  return {
    outputJson: normalized,
    richText: rendered.richText,
    html: rendered.html
  };
}

function formatCourseContext(course: CourseContext | null) {
  if (!course) return "";
  const contextLines = [
    `${course.courseCode ? `${course.courseCode} - ` : ""}${course.courseName}`,
    course.description ? `Description: ${course.description}` : "",
    course.hours != null ? `Hours: ${course.hours}` : "",
    course.year != null ? `Year: ${course.year}` : "",
    course.quarter != null ? `Quarter: ${course.quarter}` : "",
    course.developmentStatus ? `Status: ${course.developmentStatus}` : "",
    course.outcomes.length ? `Outcomes: ${course.outcomes.length}` : ""
  ].filter(Boolean);
  return contextLines.join("\n");
}

function combineMaterialsAndEquipment(materials?: string, equipment?: string) {
  const materialLines = toLines(materials);
  const equipmentLines = toLines(equipment);
  if (!materialLines.length && !equipmentLines.length) return "";
  if (!equipmentLines.length) return materialLines;
  if (!materialLines.length) return [`Equipment: ${equipmentLines.join("; ")}`];
  return [...materialLines, `Equipment: ${equipmentLines.join("; ")}`];
}

function toLines(value?: string) {
  return (value ?? "")
    .split(/\n+/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);
}
