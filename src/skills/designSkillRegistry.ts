import { Skill } from "./skillRegistry";

export const DESIGN_SKILL_REGISTRY: Skill[] = [
  // ─── Layout & Structure ───────────────────────────────────────────────
  {
    id: "responsive-layout-architect",
    name: "Responsive Layout Architect",
    category: "Layout & Structure",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Expert in Grid, Flexbox, and complex responsive architectures using a mobile-first approach.",
    triggerKeywords: ["layout", "grid", "flex", "container", "responsive", "sidebar", "holy grail", "masonry", "breakpoints", "media queries", "viewport", "aspect-ratio"],
    intentPatterns: [
      "create a responsive grid",
      "design a sidebar layout",
      "make this layout mobile friendly",
      "build a dashboard shell",
      "center a div",
      "implement a sticky header",
      "setup a multi-column layout"
    ],
    systemPromptBlock: `
      You are a Layout Architect.
      Prioritize CSS Grid for 2D layouts and Flexbox for 1D components.
      Follow a strict mobile-first approach (sm → 2xl).
      Ensure layouts are fluid: use minmax(), auto-fit, and relative units (rem/em/%) over fixed pixels.
      Maintain a consistent gap scale (multiples of 4px).
      Handle overflow and content truncation gracefully.
    `
  },
  {
    id: "css-grid-master",
    name: "CSS Grid Master",
    category: "Layout & Structure",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Specialized in advanced CSS Grid layouts, areas, and auto-placement algorithms.",
    triggerKeywords: ["css grid", "grid-template-areas", "subgrid", "fr units", "minmax", "overlap", "grid-column", "grid-row", "auto-fill", "auto-fit", "place-items", "place-content"],
    intentPatterns: [
      "create a complex grid",
      "use css subgrid",
      "define grid template areas",
      "make an overlapping grid layout",
      "build a masonry layout with grid",
      "align items in a 12-column grid"
    ],
    systemPromptBlock: `
      You are a CSS Grid Expert.
      Maximize the use of grid-template-areas for readability.
      Leverage subgrid for nested component alignment.
      Use fr units for flexible columns.
      Handle responsive layout shifts by redefining areas at breakpoints.
    `
  },
  {
    id: "flexbox-wizard",
    name: "Flexbox Wizard",
    category: "Layout & Structure",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Master of alignment, distribution, and wrapping in one-dimensional layouts.",
    triggerKeywords: ["flexbox", "justify-content", "align-items", "flex-grow", "flex-basis", "gap", "wrap", "flex-direction", "align-self", "flex-shrink", "order", "inline-flex", "space-between"],
    intentPatterns: [
      "align items in a row",
      "distribute space evenly",
      "make elements wrap in a flex container",
      "build a flex-based navbar",
      "center items vertically and horizontally",
      "create a flexible card footer"
    ],
    systemPromptBlock: `
      You are a Flexbox Wizard.
      Solve alignment issues using justify-content and align-items.
      Use gap instead of margins for spacing.
      Explain the interaction between flex-grow, flex-shrink, and flex-basis.
      Ensure components remain functional when content wraps.
    `
  },
  {
    id: "z-index-manager",
    name: "Z-Index & Stacking Context",
    category: "Layout & Structure",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Manages layering, modals, and tooltips by strictly controlling stacking contexts.",
    triggerKeywords: ["z-index", "stacking context", "isolation", "layering", "overlay", "portal", "fixed", "absolute", "relative", "backdrop", "opacity", "transform", "will-change"],
    intentPatterns: [
      "fix my z-index issue",
      "create a modal overlay",
      "manage layering for tooltips",
      "isolate stacking context",
      "make an element stay on top",
      "handle dropdown layering issues"
    ],
    systemPromptBlock: `
      You are a Layering Specialist.
      Avoid z-index wars. Use isolation: isolate to create fresh stacking contexts.
      Define a consistent z-index scale (e.g., 0, 10, 20... modal: 1000).
      Use React Portals for elements that need to break out of parent stacking contexts.
    `
  },

  // ─── Component Design ─────────────────────────────────────────────────
  {
    id: "tailwind-component-builder",
    name: "Tailwind Component Builder",
    category: "Component Design",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Generates pixel-perfect, utility-first components with dark mode and hover states.",
    triggerKeywords: ["tailwind", "component", "utility", "button", "card", "tw", "classes", "variants", "hover", "focus", "active", "group-hover", "peer-checked", "ring", "shadow"],
    intentPatterns: [
      "build a tailwind button",
      "create a card component",
      "style this with utility classes",
      "make a responsive navbar",
      "design a landing page section",
      "add a hover effect with tailwind"
    ],
    systemPromptBlock: `
      You are a senior UI engineer specializing in Tailwind CSS.
      Always use Tailwind utility classes — never write custom CSS.
      Follow: mobile-first responsive design (sm → 2xl).
      Always include: dark mode variants (dark:), hover (hover:), and focus (focus:) states.
      Use consistent spacing (multiples of 4).
      Output clean JSX with TypeScript props.
    `
  },
  {
    id: "modal-dialog-pro",
    name: "Modal & Dialog Pro",
    category: "Component Design",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Builds accessible, keyboard-navigable modals and dialogs with focus trapping.",
    triggerKeywords: ["modal", "dialog", "drawer", "popup", "focus trap", "overlay", "esc to close", "backdrop", "aria-modal", "aria-labelledby", "radix-ui", "portal", "focus-visible"],
    intentPatterns: [
      "create an accessible modal",
      "build a slide-out drawer",
      "add a focus trap to my dialog",
      "make a popup window",
      "ensure modal is keyboard navigable",
      "handle clicking outside to close"
    ],
    systemPromptBlock: `
      You are a Modal Specialist.
      Ensure all dialogs use the <dialog> tag or Radix UI primitives.
      Implement focus trapping: focus stays inside the modal until closed.
      Ensure 'Esc' key closes the modal and clicking outside close it.
      Add appropriate ARIA roles (aria-modal, aria-labelledby).
    `
  },
  {
    id: "form-expert",
    name: "Form & Validation Expert",
    category: "Component Design",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Designs user-friendly forms with clear validation, error states, and loading indicators.",
    triggerKeywords: ["form", "input", "validation", "zod", "react-hook-form", "error message", "placeholder", "submit", "label", "fieldset", "legend", "checkbox", "radio", "select", "multiselect"],
    intentPatterns: [
      "build a login form",
      "validate inputs with zod",
      "show error messages on form",
      "create a multi-step form",
      "add a custom validation rule",
      "handle form submission loading state"
    ],
    systemPromptBlock: `
      You are a Form Specialist.
      Use react-hook-form for state management and Zod for validation.
      Provide clear, real-time error messages.
      Ensure every input has a <label> with a matching id.
      Handle loading and disabled states during submission.
    `
  },
  {
    id: "table-data-specialist",
    name: "Data Table Specialist",
    category: "Component Design",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Generates high-performance tables with sorting, filtering, and pagination.",
    triggerKeywords: ["table", "datatable", "sort", "filter", "pagination", "sticky header", "tanstack table", "columns", "rows", "cell", "header", "footer", "selection", "virtuoso", "virtualization"],
    intentPatterns: [
      "create a searchable table",
      "add pagination to my table",
      "build a sortable data grid",
      "make a sticky header table",
      "implement row selection in a table",
      "render 10000 rows efficiently"
    ],
    systemPromptBlock: `
      You are a Data Table Expert.
      Prefer TanStack Table (React Table) for complex logic.
      Ensure the table is responsive: use horizontal scrolling on mobile.
      Implement virtualized rows for large datasets.
      Focus on accessibility: use proper <thead>, <tbody>, and <th> tags.
    `
  },

  // ─── Design Systems ───────────────────────────────────────────────────
  {
    id: "design-token-generator",
    name: "Design Token Generator",
    category: "Design Systems",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Creates and manages unified color palettes, spacing scales, and typography systems.",
    triggerKeywords: ["design tokens", "theme", "palette", "spacing scale", "typography", "variables", "style guide", "tokens", "json tokens", "css variables", "hsl", "rgb", "hex", "contrast"],
    intentPatterns: [
      "generate a color palette",
      "define design tokens",
      "create a typography system",
      "setup css variables for a theme",
      "export design tokens to json",
      "audit my design tokens for consistency"
    ],
    systemPromptBlock: `
      You are a Design System Architect.
      Typography: Use a proper type scale (12/14/16/18/20/24/30/36/48/60/72px).
      Color: Output full 50-900 palettes. Use CSS variables (--color-primary-500).
      Spacing: Strict 4px base grid. All values must be multiples of 4.
      Provide a centralized configuration (tailwind.config.js or globals.css).
    `
  },
  {
    id: "theming-engine-builder",
    name: "Theming Engine Builder",
    category: "Design Systems",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Builds advanced multi-theme systems (light, dark, high contrast, branded).",
    triggerKeywords: ["theming", "multi-theme", "high contrast", "color-scheme", "theme-provider", "next-themes", "css variables", "attribute", "class", "localstorage", "system theme", "context"],
    intentPatterns: [
      "setup a theme provider",
      "add a high contrast mode",
      "manage multiple brand themes",
      "switch themes dynamically",
      "detect user theme preference",
      "prevent theme flashing on page load"
    ],
    systemPromptBlock: `
      You are a Theming Specialist.
      Use the next-themes library for Next.js apps.
      Define theme values using CSS variables.
      Ensure semantic naming: --bg-primary instead of --white.
      Handle system preference detection correctly.
    `
  },
  {
    id: "typography-specialist",
    name: "Typography Specialist",
    category: "Design Systems",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Optimizes readability, line heights, and font pairing for maximum legibility.",
    triggerKeywords: ["typography", "fonts", "line-height", "kerning", "font-pairing", "legibility", "clamping", "serif", "sans-serif", "monospace", "letter-spacing", "text-transform", "font-weight"],
    intentPatterns: [
      "improve text readability",
      "pair two fonts",
      "use fluid typography",
      "optimize line heights",
      "set a vertical rhythm",
      "configure font smoothing"
    ],
    systemPromptBlock: `
      You are a Typography Expert.
      Enforce an 80-character maximum line length for prose.
      Use clamp() for responsive font sizing.
      Prioritize system font stacks or performance-optimized web fonts.
      Ensure sufficient contrast for all text sizes.
    `
  },
  {
    id: "icon-system-architect",
    name: "Icon System Architect",
    category: "Design Systems",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Manages SVG icon libraries, accessibility, and consistent sizing.",
    triggerKeywords: ["icons", "svg", "lucide", "phosphor", "icon system", "aria-hidden", "viewbox", "currentColor", "stroke", "fill", "path", "symbol", "defs", "use tag"],
    intentPatterns: [
      "setup an icon system",
      "optimize svg icons",
      "make icons accessible",
      "create an icon wrapper component",
      "handle icon color dynamically",
      "add an icon to a button"
    ],
    systemPromptBlock: `
      You are an Icon System Architect.
      Use Lucide React or Radix Icons by default.
      Ensure all decorative icons have aria-hidden="true".
      Create a wrapper component to handle sizing and color normalization.
      Optimize SVGs: remove unnecessary metadata and use current-color.
    `
  },

  // ─── Tailwind CSS ─────────────────────────────────────────────────────
  {
    id: "tailwind-optimizer",
    name: "Tailwind Optimizer",
    category: "Tailwind CSS",
    source: "https://tailwindcss.com",
    description: "Cleans up Tailwind classes using @apply, cn() helper, and custom plugins.",
    triggerKeywords: ["tailwind cleanup", "cn helper", "clsx", "tailwind-merge", "@apply", "tailwind config", "jit", "purge", "content", "theme", "extend", "layer", "utilities"],
    intentPatterns: [
      "refactor my tailwind classes",
      "setup the cn helper",
      "write a tailwind plugin",
      "clean up long class lists",
      "extend my tailwind theme",
      "optimize tailwind for production"
    ],
    systemPromptBlock: `
      You are a Tailwind Optimizer.
      Use the 'cn' utility (clsx + tailwind-merge) to combine classes dynamically.
      Avoid @apply in CSS files; prefer keeping styles in JSX.
      Group related utilities (layout, spacing, colors, effects).
      Suggest tailwind.config.js extensions for project-specific tokens.
    `
  },
  {
    id: "tailwind-plugin-dev",
    name: "Tailwind Plugin Developer",
    category: "Tailwind CSS",
    source: "https://tailwindcss.com",
    description: "Builds custom Tailwind CSS plugins for advanced utilities and component classes.",
    triggerKeywords: ["tailwind plugin", "addUtilities", "addComponents", "variant", "theme() function", "e() function", "postcss", "node-js", "tailwind-config", "directive", "prefix"],
    intentPatterns: [
      "write a custom tailwind plugin",
      "add a new utility class to tailwind",
      "create a complex hover variant",
      "extend tailwind with custom variants",
      "build a plugin for scrollbars",
      "add support for line-clamp"
    ],
    systemPromptBlock: `
      You are a Tailwind Plugin Developer.
      Use the plugin() function from tailwindcss/plugin.
      Handle theme() references for consistency with tokens.
      Ensure plugins are documented and don't conflict with core utilities.
    `
  },
  {
    id: "tailwind-animation-wizard",
    name: "Tailwind Animation Wizard",
    category: "Tailwind CSS",
    source: "https://tailwindcss.com",
    description: "Expert in Tailwind's native transitions, transforms, and arbitrary value animations.",
    triggerKeywords: ["animate-", "transition-", "duration-", "ease-", "keyframes", "spin", "ping", "bounce", "pulse", "animate-in", "animate-out", "zoom", "fade", "slide"],
    intentPatterns: [
      "animate a button with tailwind",
      "add a loading spinner with tailwind",
      "create custom keyframes in tailwind",
      "make a smooth transition",
      "animate an item into view",
      "use arbitrary animation values"
    ],
    systemPromptBlock: `
      You are a Tailwind Animation Wizard.
      Prioritize native utilities (animate-pulse, transition-all).
      Use arbitrary values [animation-delay:200ms] for one-off tweaks.
      Extend tailwind.config.js for reusable animations and keyframes.
    `
  },
  {
    id: "tailwind-v4-specialist",
    name: "Tailwind v4 Specialist",
    category: "Tailwind CSS",
    source: "https://tailwindcss.com",
    description: "Deep knowledge of Tailwind CSS v4's new engine, JIT improvements, and simplified config.",
    triggerKeywords: ["tailwind v4", "oxidizer", "engine", "simplified config", "zero-runtime", "lightningcss", "next engine", "alpha", "beta", "performance", "rust engine"],
    intentPatterns: [
      "upgrade to tailwind v4",
      "use tailwind v4 features",
      "explain the new tailwind engine",
      "setup a v4 project",
      "migrate from v3 to v4",
      "check v4 feature support"
    ],
    systemPromptBlock: `
      You are a Tailwind v4 Specialist.
      Embrace the zero-configuration philosophy where possible.
      Understand the shift toward CSS-first configuration.
      Leverage improved performance for large class lists.
    `
  },

  // ─── shadcn/ui ────────────────────────────────────────────────────────
  {
    id: "shadcn-ui-composer",
    name: "shadcn/ui Composer",
    category: "shadcn/ui",
    source: "https://ui.shadcn.com",
    description: "Master of shadcn/ui installation, customization, and complex composition.",
    triggerKeywords: ["shadcn", "radix", "ui component", "npx shadcn", "components.json", "registry", "add component", "init shadcn", "themable", "accessible components"],
    intentPatterns: [
      "install a shadcn component",
      "customize a shadcn theme",
      "compose shadcn buttons and inputs",
      "setup shadcn in a new project",
      "wrap a shadcn component",
      "fix shadcn layout issues"
    ],
    systemPromptBlock: `
      You are a shadcn/ui Expert.
      Follow the principles of "copy and paste" components — don't over-abstract.
      Customize themes via the globals.css variable system.
      Leverage Radix UI primitives for behavior and Tailwind for styling.
      Keep component code visible and editable.
    `
  },
  {
    id: "shadcn-table-expert",
    name: "shadcn/ui Data Table Pro",
    category: "shadcn/ui",
    source: "https://ui.shadcn.com",
    description: "Expert in building complex data grids using shadcn's Table component and TanStack Table.",
    triggerKeywords: ["shadcn table", "data table", "column definition", "row selection", "faceted filter", "sorting", "pagination", "search", "visibility", "rendering"],
    intentPatterns: [
      "build a shadcn data table",
      "add filtering to shadcn table",
      "implement row selection in shadcn",
      "customize shadcn table cells",
      "add search to my shadcn table",
      "setup pagination with shadcn table"
    ],
    systemPromptBlock: `
      You are a shadcn/ui Data Table Specialist.
      Use the official shadcn/ui table templates.
      Integrate TanStack Table for headless logic.
      Implement faceted filters and column visibility toggles.
    `
  },
  {
    id: "shadcn-form-wizard",
    name: "shadcn/ui Form Wizard",
    category: "shadcn/ui",
    source: "https://ui.shadcn.com",
    description: "Builds production-ready forms using shadcn's Form (React Hook Form + Zod) components.",
    triggerKeywords: ["shadcn form", "formfield", "formitem", "formlabel", "formmessage", "react-hook-form", "zod", "input", "validation", "controller"],
    intentPatterns: [
      "create a shadcn login form",
      "validate shadcn inputs",
      "handle shadcn form submission",
      "use zod with shadcn forms",
      "build a complex shadcn form",
      "add validation error messages"
    ],
    systemPromptBlock: `
      You are a shadcn/ui Form Specialist.
      Strictly follow the <Form> component structure: Provider → Field → Item → Control → Label → Input.
      Use the FormMessage component for accessible error reporting.
    `
  },
  {
    id: "shadcn-theme-customizer",
    name: "shadcn/ui Theme Customizer",
    category: "shadcn/ui",
    source: "https://ui.shadcn.com",
    description: "Expert in the shadcn/ui theming system, CSS variables, and secondary/muted palettes.",
    triggerKeywords: ["shadcn theme", "css variables", "zinc", "slate", "primary", "secondary", "radius", "hsl", "background", "foreground", "border", "input", "ring"],
    intentPatterns: [
      "change shadcn brand color",
      "adjust shadcn border radius",
      "create a dark theme for shadcn",
      "customize shadcn muted colors",
      "add a custom secondary color to shadcn",
      "audit shadcn theme variables"
    ],
    systemPromptBlock: `
      You are a shadcn/ui Theming Expert.
      Modify themes in globals.css using HSL values.
      Ensure the primary-foreground color maintains contrast against primary.
      Adjust the --radius variable for a consistent look.
    `
  },

  // ─── Animation & Motion ───────────────────────────────────────────────
  {
    id: "framer-motion-animator",
    name: "Framer Motion Animator",
    category: "Animation & Motion",
    source: "https://www.framer.com/motion",
    description: "Creates smooth transitions, physics-based motion, and orchestrated page loads.",
    triggerKeywords: ["framer motion", "animatepresence", "variants", "whilehover", "layoutId", "stagger", "spring", "initial", "animate", "exit", "transition", "controls"],
    intentPatterns: [
      "animate a list with framer motion",
      "add a page transition",
      "create a staggered entrance animation",
      "use layoutId for shared elements",
      "implement scroll-triggered animation",
      "control animation sequence manually"
    ],
    systemPromptBlock: `
      You are a Motion Designer.
      Use Variants to keep animation logic clean and reusable.
      Leverage AnimatePresence for exit animations.
      Prioritize spring physics over linear easing for a physical feel.
      Stagger children using transition: { staggerChildren: 0.1 }.
      Performance: Use transform and opacity only.
    `
  },
  {
    id: "micro-interaction-expert",
    name: "Micro-Interaction Expert",
    category: "Animation & Motion",
    source: "https://www.framer.com/motion",
    description: "Focused on small, delightful UI responses to user actions (clicks, hovers, focus).",
    triggerKeywords: ["micro-interaction", "feedback", "haptic", "hover effect", "active state", "button click", "loading-spinner", "check-animation", "ripple", "bounce", "scale"],
    intentPatterns: [
      "add a hover scale to a button",
      "animate a success checkmark",
      "create a loading state transition",
      "make a subtle wiggle on error",
      "implement button click feedback",
      "add a ripple effect"
    ],
    systemPromptBlock: `
      You are a Micro-Interaction Specialist.
      Keep interactions fast (<150ms).
      Use subtle scales (1.02x) and rotations.
      Ensure interactions don't distract from the core task.
    `
  },
  {
    id: "lottie-integrator",
    name: "Lottie Animation Integrator",
    category: "Animation & Motion",
    source: "https://lottiefiles.com",
    description: "Specialist in integrating high-quality vector animations using Lottie and DotLottie.",
    triggerKeywords: ["lottie", "dotlottie", "json animation", "bodymovin", "animation loop", "play", "pause", "speed", "interactivity", "segment", "layer", "renderer"],
    intentPatterns: [
      "add a lottie animation",
      "control lottie playback with scroll",
      "trigger lottie on click",
      "optimize lottie files",
      "change lottie animation speed",
      "play a specific lottie segment"
    ],
    systemPromptBlock: `
      You are a Lottie Specialist.
      Use lottie-react for easy integration.
      Ensure animations are lazy-loaded.
      Control playback using refs and interactivity hooks.
    `
  },
  {
    id: "scroll-animation-wizard",
    name: "Scroll Animation Wizard",
    category: "Animation & Motion",
    source: "https://www.framer.com/motion",
    description: "Builds scroll-triggered animations, parallax effects, and progress indicators.",
    triggerKeywords: ["scroll animation", "parallax", "scroll progress", "sticky scroll", "viewport enter", "useScroll", "useTransform", "intersection observer", "reveal", "fade-in-scroll"],
    intentPatterns: [
      "animate items as they scroll into view",
      "create a parallax background",
      "add a scroll progress bar",
      "make a sticky revealing section",
      "fade in cards on scroll",
      "pin an element during scroll"
    ],
    systemPromptBlock: `
      You are a Scroll Animation Expert.
      Use useScroll and useTransform from Framer Motion.
      Implement Intersection Observer for "on enter" triggers.
      Ensure scroll heavy pages remain performant (passive listeners).
    `
  },

  // ─── Accessibility ────────────────────────────────────────────────────
  {
    id: "accessibility-enforcer",
    name: "Accessibility Enforcer",
    category: "Accessibility",
    source: "https://www.radix-ui.com",
    description: "Strictly follows WCAG 2.1 standards, ARIA roles, and keyboard navigation rules.",
    triggerKeywords: ["wcag", "aria", "a11y", "screen reader", "keyboard nav", "contrast", "tabindex", "role", "landmark", "focus-ring", "alt-text", "semantic-html"],
    intentPatterns: [
      "audit my code for accessibility",
      "add aria labels to my navbar",
      "make this component keyboard navigable",
      "check color contrast",
      "fix a11y warnings",
      "ensure forms are accessible"
    ],
    systemPromptBlock: `
      You are an Accessibility Consultant.
      Every interactive element must have a visible focus ring.
      Use semantic HTML: <button> for actions, <a> for navigation.
      Add aria-label or aria-labelledby to non-text elements.
      Support 'Reduced Motion' preferences.
    `
  },
  {
    id: "screen-reader-expert",
    name: "Screen Reader Expert",
    category: "Accessibility",
    source: "https://www.radix-ui.com",
    description: "Specializes in optimizing UI for NVDA, JAWS, and VoiceOver.",
    triggerKeywords: ["voiceover", "nvda", "aria-live", "announcements", "visually-hidden", "sr-only", "jaws", "reader-friendly", "aria-describedby", "hidden", "labeling"],
    intentPatterns: [
      "make this status update announced by screen readers",
      "hide elements from screen readers but keep for visual users",
      "optimize my heading structure for a11y",
      "create a skip to content link",
      "ensure dynamic content is announced",
      "fix screen reader pronunciation issues"
    ],
    systemPromptBlock: `
      You are a Screen Reader Specialist.
      Use aria-live="polite" for dynamic updates.
      Implement the .sr-only class for visually hidden descriptive text.
      Ensure heading levels (h1-h6) are hierarchical.
    `
  },
  {
    id: "keyboard-navigation-pro",
    name: "Keyboard Navigation Pro",
    category: "Accessibility",
    source: "https://www.radix-ui.com",
    description: "Expert in tab-index management, focus rings, and custom shortcut implementations.",
    triggerKeywords: ["tab-index", "focus-visible", "focus-within", "keyboard shortcut", "hotkeys", "focus trap", "navigation", "outline", "ring", "tab-order"],
    intentPatterns: [
      "manage tab order in a complex menu",
      "add keyboard shortcuts to my app",
      "fix focus ring visibility",
      "implement arrow key navigation",
      "make an element focusable",
      "handle keyboard interaction in a modal"
    ],
    systemPromptBlock: `
      You are a Keyboard Interaction Specialist.
      Use focus-visible to only show rings for keyboard users.
      Avoid tabindex > 0.
      Implement standard patterns: Space/Enter to activate, Esc to close.
    `
  },
  {
    id: "color-blindness-specialist",
    name: "Color Blindness Specialist",
    category: "Accessibility",
    source: "https://www.radix-ui.com",
    description: "Optimizes UI for various types of color vision deficiencies (Protanopia, Deuteranopia, etc.).",
    triggerKeywords: ["color blind", "contrast ratio", "patterns", "color safe", "protanopia", "deuteranopia", "tritanopia", "achromatopsia", "palette", "safe colors", "indicator"],
    intentPatterns: [
      "make my chart color blind friendly",
      "check if this palette is accessible",
      "add textures to represent data states",
      "verify contrast ratios",
      "design for red-green color blindness",
      "ensure success/error states aren't just color-based"
    ],
    systemPromptBlock: `
      You are a Color Accessibility Expert.
      Never rely on color alone to convey meaning (add icons or text).
      Use patterns or shapes in charts.
      Ensure minimum 4.5:1 contrast for normal text.
    `
  },

  // ─── Figma to Code ────────────────────────────────────────────────────
  {
    id: "figma-to-react-converter",
    name: "Figma-to-React Converter",
    category: "Figma to Code",
    source: "https://v0.dev",
    description: "Converts design screenshots or specifications into clean, maintainable React components.",
    triggerKeywords: ["figma", "handoff", "pixel perfect", "design to code", "blueprint", "copy design", "dev-mode", "export", "styles", "components", "inspection"],
    intentPatterns: [
      "convert this image to react",
      "build this component from my figma spec",
      "make this look exactly like the design",
      "implement this figma layout",
      "translate figma styles to tailwind",
      "setup a component from a screenshot"
    ],
    systemPromptBlock: `
      You are a Design Engineer.
      Translate pixel values to the nearest Tailwind spacing tokens.
      Extract typography styles (weight, size, line-height).
      Identify component boundaries and create a modular React structure.
      Preserve the "spirit" of the design while using production-grade code patterns.
    `
  },
  {
    id: "pixel-perfect-styler",
    name: "Pixel-Perfect Styler",
    category: "Figma to Code",
    source: "https://v0.dev",
    description: "Focuses on extreme visual accuracy, spacing, and micro-alignments.",
    triggerKeywords: ["pixel perfect", "precision", "alignment", "sub-pixel", "rendering", "exact match", "meticulous", "visual-check", "overlay", "comparison", "spacing"],
    intentPatterns: [
      "make this padding exactly 23px",
      "align these icons perfectly with the text",
      "fix sub-pixel rendering issues",
      "ensure identical visual match",
      "optical alignment vs mathematical",
      "audit visual spacing"
    ],
    systemPromptBlock: `
      You are a Visual Precision Specialist.
      Focus on meticulous alignment and spacing.
      Check for optical centering vs mathematical centering.
      Use relative units but map them to the exact design specifications.
    `
  },
  {
    id: "svg-path-wizard",
    name: "SVG Path Wizard",
    category: "Figma to Code",
    source: "https://v0.dev",
    description: "Hand-codes and optimizes complex SVG paths and shapes from design exports.",
    triggerKeywords: ["svg path", "d attribute", "vector", "bezier curve", "viewbox", "clippath", "mask", "stroke-dasharray", "optimization", "xml", "fragment"],
    intentPatterns: [
      "convert this svg path to a react component",
      "animate an svg path",
      "create a custom vector shape",
      "optimize this exported svg",
      "fix svg scaling issues",
      "add a mask to an svg"
    ],
    systemPromptBlock: `
      You are an SVG Expert.
      Clean up bloated Figma exports.
      Use viewBox for scaling.
      Implement complex paths using the 'd' attribute directly when needed.
    `
  },
  {
    id: "design-asset-manager",
    name: "Design Asset Manager",
    category: "Figma to Code",
    source: "https://v0.dev",
    description: "Handles image optimization, responsive formats (WebP/AVIF), and lazy loading.",
    triggerKeywords: ["assets", "images", "webp", "avif", "lazy load", "srcset", "img optimization", "cdn", "loading-attribute", "compression", "formats", "rendering"],
    intentPatterns: [
      "optimize images for this page",
      "setup responsive image srcset",
      "use webp with fallback",
      "lazy load below-the-fold images",
      "handle image placeholder loading",
      "configure image compression"
    ],
    systemPromptBlock: `
      You are an Asset Specialist.
      Always prioritize WebP or AVIF formats.
      Include width and height attributes to prevent layout shift.
      Use Next.js Image component where applicable.
    `
  },

  // ─── Dark Mode ────────────────────────────────────────────────────────
  {
    id: "dark-mode-engineer",
    name: "Dark Mode Engineer",
    category: "Dark Mode",
    source: "https://github.com/pacocoursey/next-themes",
    description: "Implements comprehensive dark mode support using CSS variables and system preferences.",
    triggerKeywords: ["dark mode", "prefers-color-scheme", "theme switch", "night mode", "dark variants", "appearance", "invert", "contrast", "color-scheme"],
    intentPatterns: [
      "add dark mode to my site",
      "create a light/dark toggle",
      "style this component for dark mode",
      "fix dark mode contrast",
      "implement theme switching",
      "support system dark mode"
    ],
    systemPromptBlock: `
      You are a Dark Mode Expert.
      Use the dark: prefix for all Tailwind classes.
      Ensure background and foreground colors are swapped correctly.
      Avoid pure white on pure black; use Zinc or Slate for softer contrast.
      Update images or SVGs for dark mode where needed (opacity or filter).
    `
  },
  {
    id: "color-scheme-architect",
    name: "Color Scheme Architect",
    category: "Dark Mode",
    source: "https://github.com/pacocoursey/next-themes",
    description: "Designs semantically linked light and dark color schemes for consistent branding.",
    triggerKeywords: ["color scheme", "semantic colors", "background-surface", "text-primary", "inverted", "palette-mapping", "token-linking", "variable-sync", "theming"],
    intentPatterns: [
      "design a dark theme palette",
      "link light and dark colors semantically",
      "create an inverted color scheme",
      "define dark mode variables",
      "map design tokens to dark mode",
      "setup a consistent color system"
    ],
    systemPromptBlock: `
      You are a Color Strategy Expert.
      Define semantic variables: --background maps to white in light and slate-950 in dark.
      Ensure the same "vibe" is maintained across themes.
    `
  },
  {
    id: "system-preference-expert",
    name: "System Preference Expert",
    category: "Dark Mode",
    source: "https://github.com/pacocoursey/next-themes",
    description: "Expert in matching app themes to OS-level preferences and handling theme flash (FOUC).",
    triggerKeywords: ["fouc", "theme flash", "system preference", "localstorage theme", "matchMedia", "client-side-hydration", "flash-prevention", "sync", "detection"],
    intentPatterns: [
      "detect system theme preference",
      "prevent theme flash on load",
      "sync app theme with os",
      "save theme choice to localstorage",
      "handle hydration for themes",
      "listen for os theme changes"
    ],
    systemPromptBlock: `
      You are a Theme Integration Specialist.
      Use inline scripts in <head> to prevent Flash of Unstyled Content (FOUC).
      Listen for system theme changes using matchMedia.
    `
  },
  {
    id: "low-light-specialist",
    name: "Low-Light / OLED Specialist",
    category: "Dark Mode",
    source: "https://github.com/pacocoursey/next-themes",
    description: "Optimizes UI for OLED screens and low-light environments (True Black themes).",
    triggerKeywords: ["oled", "true black", "low light", "battery saving", "pure black", "midnight", "amoled", "contrast", "dimming", "eye-strain"],
    intentPatterns: [
      "make an oled dark theme",
      "optimize for low light viewing",
      "use true black backgrounds",
      "reduce glare in dark mode",
      "design a midnight theme",
      "save battery with black ui"
    ],
    systemPromptBlock: `
      You are an OLED Optimization Expert.
      Use #000000 for maximum battery saving on mobile devices.
      Ensure borders are visible against pure black backgrounds.
    `
  },

  // ─── 3D & WebGL ───────────────────────────────────────────────────────
  {
    id: "three-js-scene-builder",
    name: "Three.js Scene Builder",
    category: "3D & WebGL",
    source: "https://threejs.org",
    description: "Creates immersive 3D scenes, lighting, and cameras using Three.js or React Three Fiber.",
    triggerKeywords: ["three.js", "r3f", "webgl", "3d scene", "mesh", "material", "lighting", "camera", "canvas", "orbitcontrols", "geometry", "texture", "loader"],
    intentPatterns: [
      "build a 3d background",
      "add a 3d model to my react app",
      "setup three.js lighting",
      "create a rotating 3d cube",
      "configure 3d perspective camera",
      "load a glb model"
    ],
    systemPromptBlock: `
      You are a 3D Web Developer.
      Use React Three Fiber (R3F) for React projects.
      Prioritize performance: use low-poly models and optimized textures.
      Implement OrbitControls for user navigation.
      Handle responsive canvas resizing.
    `
  },
  {
    id: "particle-system-pro",
    name: "Particle System Pro",
    category: "3D & WebGL",
    source: "https://threejs.org",
    description: "Specializes in complex particle effects, starfields, and fluid simulations.",
    triggerKeywords: ["particles", "pointcloud", "starfield", "dust effect", "instancedmesh", "points", "emitter", "simulation", "shader-particles", "physics"],
    intentPatterns: [
      "make a particle background",
      "create an interactive point cloud",
      "add a floating dust effect",
      "animate 1000 items in 3d",
      "implement particle physics",
      "build a starfield effect"
    ],
    systemPromptBlock: `
      You are a Particle Effects Specialist.
      Use InstancedMesh or Points for high-performance rendering.
      Animate particles using shaders (GLSL) or frame-by-frame updates.
    `
  },
  {
    id: "shader-engineer",
    name: "GLSL Shader Engineer",
    category: "3D & WebGL",
    source: "https://threejs.org",
    description: "Writes custom GLSL vertex and fragment shaders for unique visual effects.",
    triggerKeywords: ["glsl", "shader", "fragment shader", "vertex shader", "uniforms", "varying", "attribute", "gpu-rendering", "displacement", "noise", "voronoi"],
    intentPatterns: [
      "write a custom shader for a material",
      "create a liquid effect with shaders",
      "add a noise-based displacement map",
      "implement post-processing effects",
      "calculate perlin noise in glsl",
      "animate textures with shaders"
    ],
    systemPromptBlock: `
      You are a Shader Specialist.
      Write clean, documented GLSL code.
      Use uniforms to pass interactive data to shaders.
      Implement classic effects like Simplex Noise and Chromatic Aberration.
    `
  },
  {
    id: "3d-product-viewer",
    name: "3D Product Viewer",
    category: "3D & WebGL",
    source: "https://threejs.org",
    description: "Builds interactive 3D product configurators with material swapping and hotspots.",
    triggerKeywords: ["configurator", "gltf", "product viewer", "material swap", "hotspots", "interaction", "labels", "annotation", "pbr", "environment-map"],
    intentPatterns: [
      "build a 3d product viewer",
      "swap textures on a 3d model",
      "add interactive points to a 3d scene",
      "load gltf models efficiently",
      "create a material picker in 3d",
      "implement model hotspots"
    ],
    systemPromptBlock: `
      You are a Product Visualization Expert.
      Use useGLTF from @react-three/drei for caching.
      Implement high-quality PBR (Physically Based Rendering) materials.
    `
  },

  // ─── Data Visualization ───────────────────────────────────────────────
  {
    id: "data-viz-builder",
    name: "Data Viz Builder",
    category: "Data Visualization",
    source: "https://recharts.org",
    description: "Creates interactive charts, graphs, and complex data stories using Recharts or D3.js.",
    triggerKeywords: ["charts", "graphs", "recharts", "d3", "data visualization", "bar chart", "line graph", "pie chart", "area-chart", "scatter-plot", "radar-chart", "axis", "legend"],
    intentPatterns: [
      "build a line chart with recharts",
      "create an interactive dashboard graph",
      "visualize data with d3.js",
      "make a responsive bar chart",
      "add a custom tooltip to a chart",
      "animate chart transitions"
    ],
    systemPromptBlock: `
      You are a Data Visualization Specialist.
      Use Recharts for standard UI charts and D3.js for custom visualizations.
      Ensure charts are responsive and accessible.
      Provide interactive tooltips and legends.
      Optimize for performance with large datasets.
    `
  },
  {
    id: "dashboard-architect",
    name: "Dashboard Architect",
    category: "Data Visualization",
    source: "https://recharts.org",
    description: "Designs analytics dashboards with KPIs, real-time data, and grid-based layouts.",
    triggerKeywords: ["kpi", "analytics", "dashboard layout", "metrics", "real-time", "widgets", "grid-stack", "data-grid", "overview", "reporting", "sidebar-nav"],
    intentPatterns: [
      "design an analytics dashboard",
      "build a kpi widget",
      "create a real-time data feed UI",
      "arrange charts in a grid",
      "implement data filtering for dashboard",
      "setup a dashboard layout shell"
    ],
    systemPromptBlock: `
      You are a Dashboard Architect.
      Focus on information density and clarity.
      Use consistent sizing for widgets.
      Implement "drill-down" interactions for deeper data analysis.
    `
  },
  {
    id: "d3-geometry-wizard",
    name: "D3.js Geometry Wizard",
    category: "Data Visualization",
    source: "https://d3js.org",
    description: "Expert in complex SVG math, force-directed graphs, and geo-spatial mapping.",
    triggerKeywords: ["d3-force", "geo", "projection", "voronoi", "hull", "hierarchy", "mathematics", "svg-math", "mapping", "topology", "clustering", "force-link"],
    intentPatterns: [
      "build a force-directed graph",
      "create an interactive map with d3",
      "visualize hierarchical data",
      "calculate voronoi diagrams",
      "implement custom svg paths for data",
      "setup a world map visualization"
    ],
    systemPromptBlock: `
      You are a D3.js Specialist.
      Handle raw SVG manipulations for maximum control.
      Use scales and axes correctly for data mapping.
    `
  },
  {
    id: "infographic-designer",
    name: "Infographic Designer",
    category: "Data Visualization",
    source: "https://recharts.org",
    description: "Combines data viz with creative styling for storytelling and reports.",
    triggerKeywords: ["infographic", "data story", "creative charts", "annotated graph", "storytelling", "layout-design", "presentation", "vector-graphics", "branding"],
    intentPatterns: [
      "create an interactive infographic",
      "add annotations to a chart",
      "design a data-driven report",
      "make a creative visualization",
      "layout an info-rich report",
      "style charts for a brand story"
    ],
    systemPromptBlock: `
      You are a Visual Storyteller.
      Use annotations to highlight key data points.
      Balance aesthetic appeal with data accuracy.
    `
  },

  // ─── Mobile & Touch ───────────────────────────────────────────────────
  {
    id: "touch-interaction-pro",
    name: "Touch Interaction Pro",
    category: "Mobile & Touch",
    source: "https://use-gesture.netlify.app",
    description: "Expert in gestures (swipe, pinch, drag) and mobile-native feedback patterns.",
    triggerKeywords: ["swipe", "pinch", "drag", "touch gestures", "hammer.js", "react-use-gesture", "pointer-events", "multi-touch", "pan", "rotate", "double-tap", "long-press"],
    intentPatterns: [
      "add swipe to delete logic",
      "implement pinch-to-zoom on an image",
      "create a draggable list",
      "handle mobile touch events",
      "detect long press interaction",
      "implement pull-to-refresh"
    ],
    systemPromptBlock: `
      You are a Mobile UX Specialist.
      Use @use-gesture/react for smooth interaction handling.
      Prevent default scroll behavior when dragging.
      Implement haptic feedback patterns (visual or vibrations).
    `
  },
  {
    id: "mobile-first-architect",
    name: "Mobile-First Architect",
    category: "Mobile & Touch",
    source: "https://use-gesture.netlify.app",
    description: "Optimizes UI for small screens, slow connections, and one-handed usage.",
    triggerKeywords: ["mobile first", "one handed", "bottom sheet", "tap targets", "pwa", "reachability", "thumb-zone", "progressive", "responsive-design", "viewport-meta"],
    intentPatterns: [
      "optimize my site for one-handed use",
      "create a mobile bottom sheet menu",
      "increase tap target sizes",
      "build a mobile-first navigation",
      "design for thumb-zone reachability",
      "setup viewport meta tags"
    ],
    systemPromptBlock: `
      You are a Mobile Architect.
      Ensure all tap targets are at least 44x44px.
      Prioritize content at the bottom of the screen for thumb reach.
    `
  },
  {
    id: "pwa-expert",
    name: "PWA Expert",
    category: "Mobile & Touch",
    source: "https://use-gesture.netlify.app",
    description: "Builds Progressive Web Apps with offline support, manifests, and home-screen install.",
    triggerKeywords: ["pwa", "service worker", "manifest.json", "offline mode", "installable", "web-app", "cache-strategy", "push-notifications", "app-icon", "splash-screen"],
    intentPatterns: [
      "convert my site to a pwa",
      "add offline support with service workers",
      "configure manifest.json",
      "handle app install prompt",
      "setup push notifications",
      "audit pwa compliance"
    ],
    systemPromptBlock: `
      You are a PWA Specialist.
      Ensure high scores on Lighthouse audits.
      Implement caching strategies for offline resilience.
    `
  },
  {
    id: "responsive-font-specialist",
    name: "Responsive Typography Specialist",
    category: "Mobile & Touch",
    source: "https://use-gesture.netlify.app",
    description: "Expert in fluid typography and adaptive font sizes across all screen dimensions.",
    triggerKeywords: ["fluid typography", "viewport units", "clamping", "legibility", "font-scaling", "vw-vh", "adaptive-text", "line-height-scaling", "break-word"],
    intentPatterns: [
      "make my text size fluid",
      "optimize reading experience on mobile",
      "use css clamp for font sizes",
      "handle font scaling",
      "setup responsive line heights",
      "fix text overflow on mobile"
    ],
    systemPromptBlock: `
      You are a Typography Strategy Specialist.
      Use clamp() to prevent text from getting too small on mobile or too large on desktop.
    `
  }
];

export const DESIGN_SKILL_MAP = new Map(DESIGN_SKILL_REGISTRY.map(s => [s.id, s]));
