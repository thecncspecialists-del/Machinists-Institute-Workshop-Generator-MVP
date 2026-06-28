import { z } from "zod";

export const homePageSkillSchema = z.object({
  title: z.string().trim().default(""),
  description: z.string().trim().default("")
});

export const homePageInputSchema = z.object({
  logoImageUrl: z.string().trim().default(""),
  heroImageUrl: z.string().trim().default(""),
  logoFileName: z.string().trim().default("mi-logo-full.png"),
  heroFileName: z.string().trim().default("mi-page-header.jpg"),
  courseTitle: z.string().trim().default(""),
  duration: z.string().trim().default(""),
  totalHours: z.string().trim().default(""),
  courseStatus: z.string().trim().default(""),
  courseShellUrl: z.string().trim().default(""),
  overviewParagraphs: z.array(z.string().trim()).default([]),
  skills: z.array(homePageSkillSchema).default([])
});

export type HomePageInput = z.infer<typeof homePageInputSchema>;
export type HomePageSkill = z.infer<typeof homePageSkillSchema>;
