"use client";

import { useMemo, useState } from "react";

import { CopyHtmlButton } from "@/components/workshop-generator/CopyHtmlButton";
import { WorkshopPreview } from "@/components/workshop-generator/WorkshopPreview";
import { DEFAULT_HOME_PAGE_INPUT } from "@/lib/workshop-generator/default-home-page-input";
import { generateHomePageHtml } from "@/lib/workshop-generator/generate-workshop-html";
import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";

type HomePageTextField = Exclude<keyof HomePageInput, "overviewParagraphs" | "skills">;

function toParagraphDraft(input: HomePageInput) {
  return input.overviewParagraphs.join("\n\n");
}

export function HomePageGeneratorClient() {
  const [homePage, setHomePage] = useState<HomePageInput>(DEFAULT_HOME_PAGE_INPUT);
  const [overviewDraft, setOverviewDraft] = useState(() => toParagraphDraft(DEFAULT_HOME_PAGE_INPUT));
  const [notice, setNotice] = useState<{ message: string; success: boolean } | null>(null);

  const html = useMemo(() => generateHomePageHtml(homePage), [homePage]);

  function updateField(key: HomePageTextField, value: string) {
    setHomePage((previous) => ({ ...previous, [key]: value }));
  }

  function updateOverview(raw: string) {
    setOverviewDraft(raw);
    setHomePage((previous) => ({
      ...previous,
      overviewParagraphs: raw
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    }));
  }

  function updateSkill(index: number, key: "title" | "description", value: string) {
    setHomePage((previous) => ({
      ...previous,
      skills: previous.skills.map((skill, skillIndex) => (skillIndex === index ? { ...skill, [key]: value } : skill))
    }));
  }

  function addSkill() {
    setHomePage((previous) => ({
      ...previous,
      skills: [...previous.skills, { title: "", description: "" }]
    }));
  }

  function removeSkill(index: number) {
    setHomePage((previous) => ({
      ...previous,
      skills: previous.skills.filter((_, skillIndex) => skillIndex !== index)
    }));
  }

  function clearHomePage() {
    setHomePage(DEFAULT_HOME_PAGE_INPUT);
    setOverviewDraft(toParagraphDraft(DEFAULT_HOME_PAGE_INPUT));
    setNotice({ message: "Started a new home page draft.", success: true });
  }

  return (
    <div className="grid create-workspace workshop-workspace mode-home-page">
      {notice ? (
        <div className={`notification-strip ${notice.success ? "info" : ""}`} role="status">
          {notice.message}
        </div>
      ) : null}
      <div className="create-input-panel">
        <header className="panel builder-mode-panel">
          <h1 className="builder-title">Home Page</h1>
          <div className="builder-action-strip">
            <div className="active-context-chip">
              <span>Output</span>
              <strong>Canvas course home page</strong>
            </div>
            <button className="btn ghost" type="button" onClick={clearHomePage}>
              Clear / Start New
            </button>
          </div>
        </header>

        <section className="panel">
          <div className="form-panel-header">
            <div>
              <h2>Course Homepage</h2>
            </div>
          </div>

          <div className="step-workspace compact">
            <div className="step-content">
              <div className="form-grid step-form-grid">
                <div className="field full">
                  <label htmlFor="courseTitle">Course Title *</label>
                  <input
                    id="courseTitle"
                    placeholder="BERT 105 - Basic Robotics"
                    required
                    value={homePage.courseTitle}
                    onChange={(event) => updateField("courseTitle", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="duration">Duration *</label>
                  <input
                    id="duration"
                    placeholder="2 weeks"
                    required
                    value={homePage.duration}
                    onChange={(event) => updateField("duration", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="totalHours">Total Hours *</label>
                  <input
                    id="totalHours"
                    placeholder="16"
                    required
                    value={homePage.totalHours}
                    onChange={(event) => updateField("totalHours", event.target.value)}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="logoImageUrl">Logo Image URL *</label>
                  <input
                    id="logoImageUrl"
                    placeholder="Canvas logo file preview URL"
                    required
                    value={homePage.logoImageUrl}
                    onChange={(event) => updateField("logoImageUrl", event.target.value)}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="heroImageUrl">Hero Image URL *</label>
                  <input
                    id="heroImageUrl"
                    placeholder="Canvas hero image file preview URL"
                    required
                    value={homePage.heroImageUrl}
                    onChange={(event) => updateField("heroImageUrl", event.target.value)}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="overviewParagraphs">Program Overview * (blank line between paragraphs)</label>
                  <textarea
                    id="overviewParagraphs"
                    placeholder="Describe the course or program overview..."
                    required
                    value={overviewDraft}
                    onChange={(event) => updateOverview(event.target.value)}
                  />
                </div>
              </div>

              <div className="source-panel-header skill-list-header">
                <div>
                  <div className="eyebrow">Skills</div>
                  <h3>Skills You Will Build</h3>
                </div>
                <button className="btn ghost" type="button" onClick={addSkill}>
                  Add Skill
                </button>
              </div>

              <div className="home-skill-list">
                {homePage.skills.map((skill, index) => (
                  <div className="home-skill-card" key={`${index}-${skill.title}`}>
                    <div className="field">
                      <label htmlFor={`skill-title-${index}`}>Skill Title</label>
                      <input
                        id={`skill-title-${index}`}
                        placeholder="Collaborative Robot System Awareness"
                        value={skill.title}
                        onChange={(event) => updateSkill(index, "title", event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`skill-description-${index}`}>Skill Description</label>
                      <textarea
                        id={`skill-description-${index}`}
                        placeholder="Describe the skill apprentices will build."
                        value={skill.description}
                        onChange={(event) => updateSkill(index, "description", event.target.value)}
                      />
                    </div>
                    <button className="btn ghost" type="button" onClick={() => removeSkill(index)}>
                      Remove Skill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="preview-panel">
        <WorkshopPreview html={html} title="Home Page Generator" />
      </div>

      <section className="panel source-panel-wide">
        <div className="source-panel-header">
          <div>
            <div className="eyebrow">Copy Source</div>
            <h3>Canvas HTML</h3>
          </div>
          <CopyHtmlButton html={html} onCopied={(message, success) => setNotice({ message, success })} />
        </div>
        <pre className="html-code source-code-panel">
          {html}
        </pre>
      </section>
    </div>
  );
}
