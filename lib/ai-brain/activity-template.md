# Activity Template

Return a single JSON object for an `Activity` asset. Use this exact top-level shape:

```json
{
  "assetType": "Activity",
  "draftNotice": "AI-generated draft. Human review required before use.",
  "title": "",
  "sections": [
    { "id": "overview", "heading": "Activity Overview", "audience": "Instructor", "content": "" },
    { "id": "course_context", "heading": "Course Context", "audience": "Instructor", "content": "" },
    { "id": "learning_outcomes", "heading": "Learning Outcomes", "audience": "Both", "content": [] },
    { "id": "duration_and_timing", "heading": "Duration and Timing", "audience": "Instructor", "content": "" },
    { "id": "materials_and_equipment", "heading": "Materials and Equipment", "audience": "Instructor", "content": [] },
    { "id": "preparation", "heading": "Preparation", "audience": "Instructor", "content": [] },
    { "id": "facilitation_plan", "heading": "Facilitation Plan", "audience": "Instructor", "content": [] },
    { "id": "student_instructions", "heading": "Student Instructions", "audience": "Student", "content": [] },
    { "id": "activity_steps", "heading": "Activity Steps", "audience": "Student", "content": [] },
    { "id": "practice_checks", "heading": "Practice Checks", "audience": "Both", "content": [] },
    { "id": "assessment", "heading": "Assessment or Evidence of Learning", "audience": "Instructor", "content": "" },
    { "id": "references", "heading": "References and Links", "audience": "Both", "content": [] },
    { "id": "review_notes", "heading": "Human Review Notes", "audience": "Instructor", "content": "" }
  ]
}
```

Activity drafts should be concrete learner-facing practice experiences. Keep
setup, facilitation, student actions, checks for understanding, assessment, and
human review notes separate. Leave missing official course details blank.
