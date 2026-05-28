import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAssetPrompt } from "@/lib/aiBrain";
import { activeAssetTypes } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { logBackendError, logBackendEvent } from "@/lib/logger";
import { renderStructuredAsset, validateAssetOutput } from "@/lib/renderAsset";

export const runtime = "nodejs";

/**
 * AI draft generation API.
 *
 * Expects JSON with courseId, an active assetType, and user input fields.
 * It reads locked imported course context and outcomes, sends that bounded
 * context to the AI provider, validates the returned template, and renders rich
 * text plus Canvas-friendly HTML. It never writes imported course data and does
 * not save the asset; saving is handled by /api/assets.
 */
const generateSchema = z.object({
  courseId: z.string().uuid().optional().nullable(),
  assetType: z.enum(activeAssetTypes),
  input: z.record(z.string()).default({})
});

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logBackendEvent("ai_generation_failed", { reason: "missing_openai_api_key" });
    return NextResponse.json(
      {
        error:
          "AI generation is not configured. Set OPENAI_API_KEY in your environment before generating draft content."
      },
      { status: 503 }
    );
  }

  try {
    const payload = generateSchema.parse(await request.json());
    logBackendEvent("ai_generation_requested", {
      courseId: payload.courseId,
      assetType: payload.assetType
    });

    let course: {
      id: string;
      courseCode: string | null;
      courseName: string;
      description: string | null;
      hours: number | null;
      year: number | null;
      quarter: number | null;
      syllabusUrl: string | null;
      canvasShellUrl: string | null;
      developmentStatus: string | null;
      enrollmentTrackerUrl: string | null;
      outcomes: { outcomeCode: string | null; description: string }[];
    } | null = null;

    if (payload.courseId) {
      course = await prisma.course.findUnique({
        where: { id: payload.courseId },
        include: { outcomes: { orderBy: { rowIndex: "asc" } } }
      });

      if (!course) {
        return NextResponse.json({ error: "Course not found." }, { status: 404 });
      }
    }

    const { system, user } = buildAssetPrompt({
      assetType: payload.assetType,
      context: course
        ? {
            course: {
              id: course.id,
              courseCode: course.courseCode,
              courseName: course.courseName,
              description: course.description,
              hours: course.hours,
              year: course.year,
              quarter: course.quarter,
              syllabusUrl: course.syllabusUrl,
              canvasShellUrl: course.canvasShellUrl,
              developmentStatus: course.developmentStatus,
              enrollmentTrackerUrl: course.enrollmentTrackerUrl
            },
            outcomes: course.outcomes.map((outcome) => ({
              outcomeCode: outcome.outcomeCode,
              description: outcome.description
            }))
          }
        : null,
      input: payload.input
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      logBackendEvent("ai_generation_failed", { status: response.status, detail });
      return NextResponse.json(
        { error: "AI generation failed. Check the server logs for provider details." },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logBackendEvent("ai_generation_failed", { reason: "empty_model_content" });
      return NextResponse.json({ error: "AI generation returned no content." }, { status: 502 });
    }

    const parsedJson = parseModelJson(content);
    const title = payload.input.topic
      ? `${course?.courseCode ? `${course.courseCode}: ` : ""}${payload.input.topic} ${payload.assetType}`
      : `${course?.courseName ?? "Curriculum"} ${payload.assetType}`;
    const outputJson = validateAssetOutput(parsedJson, payload.assetType, title);
    const rendered = renderStructuredAsset(outputJson);

    logBackendEvent("ai_generation_succeeded", {
      courseId: course?.id ?? null,
      sectionCount: outputJson.sections.length
    });

    return NextResponse.json({
      outputJson,
      richText: rendered.richText,
      html: rendered.html
    });
  } catch (error) {
    logBackendError("ai_generation_failed", error);
    return NextResponse.json(
      { error: "The workshop draft could not be generated. Check the course context and server logs." },
      { status: 500 }
    );
  }
}

function parseModelJson(content: string) {
  const stripped = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(stripped) as unknown;
}
