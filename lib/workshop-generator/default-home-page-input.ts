import type { HomePageInput } from "@/lib/workshop-generator/home-page-schema";

export const DEFAULT_HOME_PAGE_INPUT: HomePageInput = {
  logoImageUrl: "",
  heroImageUrl: "",
  logoFileName: "mi-logo-full.png",
  heroFileName: "mi-page-header.jpg",
  courseTitle: "",
  duration: "",
  totalHours: "",
  courseStatus: "",
  courseShellUrl: "",
  overviewParagraphs: [],
  skills: [
    { title: "Skill 1", description: "Description" },
    { title: "Skill 2", description: "Description" },
    { title: "Skill 3", description: "Description" },
    { title: "Skill 4", description: "Description" }
  ]
};
