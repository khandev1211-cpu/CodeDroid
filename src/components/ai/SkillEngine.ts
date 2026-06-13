import { Skill, SKILL_REGISTRY } from "../../skills/skillRegistry"

/**
 * Design intent signals — these indicate a frontend/UI request.
 */
const DESIGN_INTENT_SIGNALS = [
  "design", "ui", "ux", "layout", "component", "style",
  "color", "font", "animation", "responsive", "mobile",
  "dark mode", "theme", "figma", "landing page", "dashboard",
  "navbar", "sidebar", "modal", "card", "button", "form",
  "hero section", "pricing", "beautiful", "clean", "modern",
  "grid", "flex", "tailwind", "shadcn", "framer", "motion",
  "accessibility", "aria", "webgl", "canvas", "threejs", "chart",
  "visualization", "responsive", "breakpoint"
]

const DESIGN_CATEGORIES = [
  'Layout & Structure', 'Component Design', 'Design Systems',
  'Tailwind CSS', 'shadcn/ui', 'Animation & Motion',
  'Accessibility', 'Figma to Code', 'Dark Mode',
  '3D & WebGL', 'Data Visualization', 'Mobile & Touch'
]

/**
 * Normalizes a prompt for better matching.
 */
function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
}

/**
 * Detects relevant skills for a given user prompt.
 * Scores skills based on keywords and intent patterns.
 * Prioritizes design skills if design intent signals are detected.
 */
export function detectSkills(prompt: string): Skill[] {
  const normalized = normalizePrompt(prompt)
  const words = normalized.split(/\s+/)

  // Check for design intent (2+ signals)
  let designSignalCount = 0
  DESIGN_INTENT_SIGNALS.forEach(signal => {
    if (normalized.includes(signal)) designSignalCount++
  })
  const isDesignIntent = designSignalCount >= 2

  const scored = SKILL_REGISTRY.map(skill => {
    let score = 0
    const isDesignSkill = DESIGN_CATEGORIES.includes(skill.category)

    // Keyword matches (weight 1)
    skill.triggerKeywords.forEach(keyword => {
      if (normalized.includes(keyword.toLowerCase())) {
        score += 1
      }
    })

    // Intent pattern matches (weight 2)
    skill.intentPatterns.forEach(pattern => {
      if (normalized.includes(pattern.toLowerCase())) {
        score += 2
      }
    })

    // Prioritize design skills if design intent is detected
    if (isDesignIntent && isDesignSkill) {
      score *= 2 // Double the score for design skills
    } else if (isDesignIntent && !isDesignSkill) {
      score *= 0.5 // Penalize non-design skills
    }

    return { skill, score }
  })

  // Sort by score descending and filter by threshold
  return scored
    .filter(item => item.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(item => item.skill)
}

/**
 * Merges system prompt blocks from matched skills with a base prompt.
 */
export function buildSystemPrompt(skills: Skill[], basePrompt: string): string {
  if (skills.length === 0) return basePrompt

  const skillBlocks = skills.map(s => {
    return `[SKILL: ${s.name}]\n${s.systemPromptBlock.trim()}`
  })

  const mergedPrompt = `${basePrompt}\n\n${skillBlocks.join("\n\n")}\n\n[INSTRUCTIONS END]\nAlways prioritize the specialized skills instructions provided above for relevant tasks.`

  // Basic deduplication for common design instructions if multiple design skills match
  return mergedPrompt
}
