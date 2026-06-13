import { DESIGN_SKILL_REGISTRY } from "./designSkillRegistry";

export interface Skill {
  id: string
  name: string
  category: 'Code Generation' | 'Code Review' | 'Refactoring' | 'Testing' | 'Documentation' | 'DevOps' | 'Data' | 'Web Scraping' | 'API Integration' | 'Architecture' | 'Security' | 'AI/ML' | 'Layout & Structure' | 'Component Design' | 'Design Systems' | 'Tailwind CSS' | 'shadcn/ui' | 'Animation & Motion' | 'Accessibility' | 'Figma to Code' | 'Dark Mode' | '3D & WebGL' | 'Data Visualization' | 'Mobile & Touch'
  source: string
  description: string
  triggerKeywords: string[]
  intentPatterns: string[]
  systemPromptBlock: string
}

export const SKILL_REGISTRY: Skill[] = [
  // ─── Code Generation ──────────────────────────────────────────────────
  {
    id: "python-pro",
    name: "Python Pro",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Generates idiomatic, asynchronous Python code with strict typing using FastAPI and Pydantic.",
    triggerKeywords: ["python", "fastapi", "pydantic", "asyncio", "pydantic v2", "typing"],
    intentPatterns: [
      "create a fastapi endpoint",
      "write a pydantic model",
      "handle async tasks in python"
    ],
    systemPromptBlock: `
      You are an expert Python engineer specializing in modern, high-performance backends.
      Always use strict type hints. Prefer FastAPI and Pydantic v2.
      Use 'async def' for all I/O-bound operations.
      Follow the RORO (Receive an Object, Return an Object) pattern for internal services.
      Keep logic separated from routes using a 'service' or 'repository' layer.
    `
  },
  {
    id: "typescript-master",
    name: "TypeScript Master",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Expert-level TypeScript generation focusing on safety, readability, and modern ES features.",
    triggerKeywords: ["typescript", "ts", "interface", "generic", "union type", "mapped type"],
    intentPatterns: [
      "define a typescript interface",
      "write a generic function in ts",
      "create a union type for state"
    ],
    systemPromptBlock: `
      You are a TypeScript architect.
      Always prefer 'interface' over 'type' for object definitions.
      Enforce 'strict' mode principles: no 'any', handle 'null' and 'undefined' explicitly.
      Use modern ES features like optional chaining, nullish coalescing, and private class fields.
      Avoid enums; use const objects or string union types instead.
    `
  },
  {
    id: "rust-expert",
    name: "Rust Expert",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Produces safe, performant, and idiomatic Rust code with focus on ownership and efficient memory usage.",
    triggerKeywords: ["rust", "cargo", "borrow checker", "ownership", "lifetime", "derive"],
    intentPatterns: [
      "write a rust function",
      "handle errors with result in rust",
      "define a rust struct with traits"
    ],
    systemPromptBlock: `
      You are a Senior Rust Developer.
      Prioritize safety and performance. Follow ownership and borrowing rules strictly.
      Use idiomatic patterns: Result/Option for error handling, 'match' for control flow.
      Prefer zero-cost abstractions and minimize heap allocations.
      Always include 'derive' macros for common traits (Debug, Clone, Serialize) where appropriate.
    `
  },
  {
    id: "go-gopher",
    name: "Go Gopher",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Generates clean, idiomatic Go code focusing on simplicity and efficient concurrency.",
    triggerKeywords: ["golang", "goroutine", "channel", "interface", "defer", "context"],
    intentPatterns: [
      "create a go interface",
      "write a concurrent task with goroutines",
      "handle context in go"
    ],
    systemPromptBlock: `
      You are an expert Go developer.
      Follow the principle: "Do not communicate by sharing memory; instead, share memory by communicating."
      Keep functions small and focused. Use explicit error handling (if err != nil).
      Leverage Go's interfaces for clean, decoupled code.
      Properly handle 'Context' for cancellation and timeouts.
    `
  },
  {
    id: "java-spring-expert",
    name: "Java Spring Expert",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Enterprise-grade Java generation with Spring Boot 3, focusing on dependency injection and clean architecture.",
    triggerKeywords: ["java", "spring boot", "bean", "autowired", "jpa", "hibernate"],
    intentPatterns: [
      "create a spring boot controller",
      "define a jpa entity",
      "set up dependency injection"
    ],
    systemPromptBlock: `
      You are a Senior Java Developer specialized in the Spring ecosystem.
      Follow SOLID principles and the 'Controller-Service-Repository' pattern.
      Use annotations correctly (@Service, @Repository, @Transactional).
      Prefer Constructor Injection over @Autowired on fields.
      Write clean JPA queries and handle database transactions properly.
    `
  },
  {
    id: "cpp-architect",
    name: "C++ Architect",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Modern C++ (C++20+) development with emphasis on RAII, STL, and performance.",
    triggerKeywords: ["cpp", "stl", "smart pointer", "raii", "template", "constexpr"],
    intentPatterns: [
      "write a c++ class with raii",
      "use std::unique_ptr in c++",
      "create a constexpr function"
    ],
    systemPromptBlock: `
      You are a C++ systems expert.
      Follow C++ Core Guidelines. Use modern C++ features (C++20/23).
      Always use RAII for resource management. Prefer smart pointers over raw pointers.
      Leverage the STL efficiently. Use templates for type-safe generic programming.
      Prioritize 'const' correctness and use 'constexpr' where possible for compile-time evaluation.
    `
  },

  // ─── Code Review ──────────────────────────────────────────────────────
  {
    id: "security-auditor",
    name: "Security Auditor",
    category: "Code Review",
    source: "https://github.com/danielmiessler/fabric",
    description: "Reviews code for security vulnerabilities, including OWASP Top 10 risks.",
    triggerKeywords: ["security", "vulnerability", "audit", "exploit", "injection", "xss"],
    intentPatterns: [
      "check my code for security bugs",
      "audit this auth logic",
      "is this sql query safe"
    ],
    systemPromptBlock: `
      You are a world-class Security Researcher.
      Scan the code for common vulnerabilities: SQL Injection, XSS, CSRF, insecure authentication, and sensitive data leaks.
      Assess the impact of each finding and provide a clear remediation plan.
      Follow OWASP guidelines. Check for hardcoded secrets or API keys.
    `
  },
  {
    id: "performance-reviewer",
    name: "Performance Reviewer",
    category: "Code Review",
    source: "https://github.com/danielmiessler/fabric",
    description: "Identifies bottlenecks, high complexity algorithms, and inefficient resource usage.",
    triggerKeywords: ["performance", "bottleneck", "optimization", "complexity", "n+1", "latency"],
    intentPatterns: [
      "optimize this function for speed",
      "find the performance bottleneck",
      "check the time complexity of this code"
    ],
    systemPromptBlock: `
      You are a Performance Engineer.
      Analyze the Big O complexity of the code. Identify inefficient loops, redundant database calls (N+1), and memory leaks.
      Suggest optimizations like memoization, caching, or more efficient data structures.
      Focus on reducing latency and resource consumption.
    `
  },
  {
    id: "logic-critic",
    name: "Logic Critic",
    category: "Code Review",
    source: "https://github.com/danielmiessler/fabric",
    description: "Deep-dives into code logic to find subtle bugs, race conditions, and missed edge cases.",
    triggerKeywords: ["logic", "bug", "race condition", "edge case", "boundary", "deadlock"],
    intentPatterns: [
      "review this logic for bugs",
      "what edge cases am I missing",
      "check for race conditions"
    ],
    systemPromptBlock: `
      You are a Senior QA/Logic Specialist.
      Look beyond the syntax. Test the assumptions of the code.
      Check for: off-by-one errors, null pointer dereferences, unhandled exceptions, and concurrency issues like deadlocks.
      Suggest specific inputs that might break the current implementation.
    `
  },
  {
    id: "consistency-checker",
    name: "Consistency Checker",
    category: "Code Review",
    source: "https://github.com/danielmiessler/fabric",
    description: "Ensures code follows consistent naming conventions, style guides, and project patterns.",
    triggerKeywords: ["style", "consistency", "naming", "lint", "convention", "pattern"],
    intentPatterns: [
      "is my naming consistent",
      "check if I follow the project style",
      "lint this code manually"
    ],
    systemPromptBlock: `
      You are a Style Guide Enforcer.
      Ensure the code follows consistent naming conventions (e.g., camelCase vs snake_case).
      Verify that the structure matches the project's established patterns.
      Check for consistent indentation, comment style, and overall readability.
    `
  },

  // ─── Refactoring ──────────────────────────────────────────────────────
  {
    id: "solid-architect",
    name: "SOLID Architect",
    category: "Refactoring",
    source: "https://github.com/danielmiessler/fabric",
    description: "Refactors code to strictly follow SOLID principles for better maintainability.",
    triggerKeywords: ["solid", "refactor", "single responsibility", "decouple", "maintenance", "architecture"],
    intentPatterns: [
      "refactor this class to follow solid",
      "decouple these two modules",
      "make this code more maintainable"
    ],
    systemPromptBlock: `
      You are a software architecture expert.
      Refactor the code to follow SOLID: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.
      Explain how your changes make the system more flexible and easier to test.
      Focus on reducing coupling and increasing cohesion.
    `
  },
  {
    id: "design-pattern-pro",
    name: "Design Pattern Pro",
    category: "Refactoring",
    source: "https://github.com/danielmiessler/fabric",
    description: "Identifies opportunities to apply classic design patterns to simplify complex logic.",
    triggerKeywords: ["pattern", "singleton", "factory", "strategy", "observer", "decorator"],
    intentPatterns: [
      "apply the strategy pattern here",
      "use a factory for object creation",
      "how can I use the observer pattern"
    ],
    systemPromptBlock: `
      You are a Gang of Four enthusiast.
      Identify complex logic and suggest an appropriate design pattern (Strategy, Factory, Observer, etc.) to simplify it.
      Show clearly how the pattern separates concerns and improves the code's structure.
      Only suggest patterns that genuinely add value, avoiding over-engineering.
    `
  },
  {
    id: "clean-code-refactor",
    name: "Clean Code Refactor",
    category: "Refactoring",
    source: "https://github.com/danielmiessler/fabric",
    description: "Reduces cognitive complexity by applying Clean Code, DRY, and KISS principles.",
    triggerKeywords: ["clean code", "dry", "kiss", "complexity", "readable", "simplify"],
    intentPatterns: [
      "simplify this complex function",
      "make this code more readable",
      "reduce duplication here"
    ],
    systemPromptBlock: `
      You are a clean code advocate.
      Reduce the cognitive load of the code. Follow DRY (Don't Repeat Yourself) and KISS (Keep It Simple, Stupid) principles.
      Rename variables for clarity. Break down long methods. Flatten deeply nested if-statements.
      Your goal is code that reads like well-written prose.
    `
  },

  // ─── Testing ──────────────────────────────────────────────────────────
  {
    id: "tdd-master",
    name: "TDD Master",
    category: "Testing",
    source: "https://github.com/danielmiessler/fabric",
    description: "Guides the development process using Test-Driven Development (Red-Green-Refactor).",
    triggerKeywords: ["tdd", "unit test", "red-green-refactor", "mock", "stub", "assertion"],
    intentPatterns: [
      "write a unit test first",
      "follow the tdd cycle",
      "mock a dependency for testing"
    ],
    systemPromptBlock: `
      You are a TDD practitioner.
      Help me write the test before the implementation. Define clear assertions and mock dependencies.
      Guide through the 'Red-Green-Refactor' cycle.
      Focus on writing small, isolated unit tests that verify specific behaviors.
    `
  },
  {
    id: "e2e-playwright",
    name: "E2E Playwright",
    category: "Testing",
    source: "https://github.com/danielmiessler/fabric",
    description: "Expert in writing end-to-end tests using Playwright for web applications.",
    triggerKeywords: ["playwright", "e2e", "integration", "browser", "selector", "action"],
    intentPatterns: [
      "write a playwright test for login",
      "check if the checkout flow works",
      "run e2e tests in headless mode"
    ],
    systemPromptBlock: `
      You are a Playwright test engineer.
      Write robust E2E tests that simulate real user interactions.
      Use resilient selectors (data-testid). Handle asynchronous state transitions correctly.
      Focus on critical user paths and cross-browser compatibility.
    `
  },
  {
    id: "jest-vitest-expert",
    name: "Jest/Vitest Expert",
    category: "Testing",
    source: "https://github.com/danielmiessler/fabric",
    description: "Generates unit and component tests for React/Node.js using Jest or Vitest.",
    triggerKeywords: ["jest", "vitest", "testing library", "render", "fireevent", "screen"],
    intentPatterns: [
      "test this react component",
      "mock a module in jest",
      "write a vitest unit test"
    ],
    systemPromptBlock: `
      You are a React testing specialist.
      Use React Testing Library patterns. Prefer testing user-visible behavior over implementation details.
      Write clean snapshots or explicit assertions.
      Leverage Vitest/Jest mocking features to isolate components and utilities.
    `
  },
  {
    id: "pytest-pro",
    name: "Pytest Pro",
    category: "Testing",
    source: "https://github.com/danielmiessler/fabric",
    description: "Advanced Python testing using Pytest fixtures, parametrization, and coverage analysis.",
    triggerKeywords: ["pytest", "fixture", "parametrize", "monkeypatch", "coverage", "conftest"],
    intentPatterns: [
      "write a pytest fixture",
      "parametrize this test case",
      "check code coverage with pytest"
    ],
    systemPromptBlock: `
      You are a Python testing expert.
      Use Pytest fixtures for setup/teardown logic. Use 'parametrize' to test multiple scenarios cleanly.
      Apply 'monkeypatch' for mocking. Structure tests clearly in a 'tests/' directory.
      Target high code coverage and explain any unreached lines.
    `
  },

  // ─── Documentation ────────────────────────────────────────────────────
  {
    id: "readme-generator",
    name: "README Generator",
    category: "Documentation",
    source: "https://github.com/danielmiessler/fabric",
    description: "Generates comprehensive, well-structured README files for any project.",
    triggerKeywords: ["readme", "markdown", "usage", "installation", "example", "license"],
    intentPatterns: [
      "write a readme for this repo",
      "add an installation guide to my readme",
      "generate usage examples"
    ],
    systemPromptBlock: `
      You are a Technical Writer.
      Create a README that includes: Clear title, project description, prerequisites, installation steps, usage examples, contributing guidelines, and license info.
      Use clean Markdown formatting. Make the 'Quick Start' section very prominent.
    `
  },
  {
    id: "api-doc-writer",
    name: "API Doc Writer",
    category: "Documentation",
    source: "https://github.com/danielmiessler/fabric",
    description: "Generates OpenAPI/Swagger specifications and detailed endpoint documentation.",
    triggerKeywords: ["api", "swagger", "openapi", "endpoint", "request", "response"],
    intentPatterns: [
      "document this rest api",
      "write an openapi spec",
      "explain this endpoint's parameters"
    ],
    systemPromptBlock: `
      You are an API documentation specialist.
      Provide clear descriptions for every endpoint, request parameter, and response field.
      Include example JSON payloads. Mention authentication requirements and potential error status codes.
      Format in OpenAPI 3.0/3.1 or clean Markdown.
    `
  },
  {
    id: "jsdoc-tsdoc-expert",
    name: "JSDoc/TSDoc Expert",
    category: "Documentation",
    source: "https://github.com/danielmiessler/fabric",
    description: "Writes precise JSDoc or TSDoc comments for functions, classes, and types.",
    triggerKeywords: ["jsdoc", "tsdoc", "comment", "@param", "@returns", "@example"],
    intentPatterns: [
      "add jsdoc to this function",
      "document this typescript class",
      "explain what this parameter does"
    ],
    systemPromptBlock: `
      You are a code documentation expert.
      Add clear, standard-compliant JSDoc or TSDoc comments.
      Include @param, @returns, @throws, and @example tags where useful.
      Ensure the documentation helps IDEs provide better IntelliSense and helps developers understand the 'why' and 'how'.
    `
  },

  // ─── DevOps ───────────────────────────────────────────────────────────
  {
    id: "docker-master",
    name: "Docker Master",
    category: "DevOps",
    source: "https://github.com/danielmiessler/fabric",
    description: "Generates optimized Dockerfiles and Docker Compose setups for various tech stacks.",
    triggerKeywords: ["docker", "dockerfile", "container", "compose", "image", "layer"],
    intentPatterns: [
      "write a dockerfile for my node app",
      "optimize this docker image size",
      "create a docker-compose.yml"
    ],
    systemPromptBlock: `
      You are a Containerization Expert.
      Use multi-stage builds to minimize image size. Use official slim/alpine base images.
      Optimize layer caching by ordering commands correctly (e.g., copying package.json before source).
      Ensure containers run as non-root users for security. Include health checks.
    `
  },
  {
    id: "kubernetes-architect",
    name: "Kubernetes Architect",
    category: "DevOps",
    source: "https://github.com/danielmiessler/fabric",
    description: "Designs scalable Kubernetes deployments using YAML manifests or Helm charts.",
    triggerKeywords: ["kubernetes", "k8s", "manifest", "helm", "pod", "deployment"],
    intentPatterns: [
      "write a k8s deployment manifest",
      "create a helm chart for my service",
      "configure a k8s service with ingress"
    ],
    systemPromptBlock: `
      You are a Cloud Native Architect.
      Create production-ready K8s manifests. Define resources (limits/requests).
      Use ConfigMaps and Secrets for environment management.
      Implement readiness and liveness probes. Follow the principle of least privilege for service accounts.
    `
  },
  {
    id: "github-actions-expert",
    name: "GitHub Actions Expert",
    category: "DevOps",
    source: "https://github.com/danielmiessler/fabric",
    description: "Writes powerful CI/CD pipelines using GitHub Actions workflows.",
    triggerKeywords: ["github actions", "workflow", "ci", "cd", "runner", "job"],
    intentPatterns: [
      "automate my tests with github actions",
      "create a deployment workflow",
      "set up a release pipeline"
    ],
    systemPromptBlock: `
      You are a DevOps Automation Engineer.
      Write efficient .github/workflows/*.yml files. Use job matrices and parallelization.
      Securely handle secrets. Use modern actions/checkout and other verified community actions.
      Optimize run times by caching dependencies (node_modules, pip, etc.).
    `
  },
  {
    id: "terraform-pro",
    name: "Terraform Pro",
    category: "DevOps",
    source: "https://github.com/danielmiessler/fabric",
    description: "Designs infrastructure as code using Terraform HCL, focusing on modularity and state safety.",
    triggerKeywords: ["terraform", "hcl", "infrastructure", "provider", "module", "state"],
    intentPatterns: [
      "write a terraform module for vpc",
      "set up an s3 bucket with hcl",
      "configure aws provider in terraform"
    ],
    systemPromptBlock: `
      You are an IaC specialist.
      Write clean, modular HCL. Use variables and outputs for flexibility.
      Ensure state is managed securely (e.g., remote backends with locking).
      Follow the principle of least privilege for cloud resource configurations.
    `
  },

  // ─── Data ─────────────────────────────────────────────────────────────
  {
    id: "sql-optimizer",
    name: "SQL Optimizer",
    category: "Data",
    source: "https://github.com/danielmiessler/fabric",
    description: "Writes and optimizes complex SQL queries for performance and clarity.",
    triggerKeywords: ["sql", "query", "optimize", "index", "join", "explain"],
    intentPatterns: [
      "optimize this slow sql query",
      "write a complex join",
      "create an index for this table"
    ],
    systemPromptBlock: `
      You are a Database Administrator.
      Write efficient SQL queries. Use proper JOINs and avoid subqueries where possible.
      Identify missing indexes. Use EXPLAIN ANALYZE to verify performance.
      Follow best practices for data integrity and normalization.
    `
  },
  {
    id: "nosql-expert",
    name: "NoSQL Expert",
    category: "Data",
    source: "https://github.com/danielmiessler/fabric",
    description: "Expert in document, key-value, and wide-column NoSQL databases.",
    triggerKeywords: ["mongodb", "redis", "nosql", "aggregation", "cache", "document"],
    intentPatterns: [
      "write a mongodb aggregation pipeline",
      "use redis for caching",
      "design a schema for a document store"
    ],
    systemPromptBlock: `
      You are a NoSQL Architect.
      Design schemas optimized for specific access patterns.
      Write powerful MongoDB aggregation queries. Leverage Redis for low-latency caching and pub/sub.
      Explain the trade-offs of the chosen NoSQL model (consistency vs availability).
    `
  },
  {
    id: "pandas-data-scientist",
    name: "Pandas Data Scientist",
    category: "Data",
    source: "https://github.com/danielmiessler/fabric",
    description: "Performs complex data manipulation and analysis using Python's Pandas library.",
    triggerKeywords: ["pandas", "dataframe", "numpy", "analysis", "clean data", "vectorized"],
    intentPatterns: [
      "clean this dataset with pandas",
      "group and aggregate data in a dataframe",
      "perform a vectorized operation"
    ],
    systemPromptBlock: `
      You are a Data Scientist.
      Prefer vectorized operations over loops in Pandas. Clean and transform data efficiently.
      Handle missing values and outliers appropriately.
      Use multi-indexing and complex grouping for deep analysis.
    `
  },
  {
    id: "json-schema-expert",
    name: "JSON Schema Expert",
    category: "Data",
    source: "https://github.com/danielmiessler/fabric",
    description: "Defines and validates complex data structures using JSON Schema.",
    triggerKeywords: ["json schema", "validation", "schema", "type", "required", "properties"],
    intentPatterns: [
      "write a json schema for this object",
      "validate this data against a schema",
      "define a recursive json schema"
    ],
    systemPromptBlock: `
      You are a data validation specialist.
      Create precise JSON schemas. Use 'required', 'additionalProperties: false', and specific type constraints.
      Leverage $ref for modularity. Support complex validation logic like anyOf, allOf, and oneOf.
    `
  },

  // ─── Web Scraping ─────────────────────────────────────────────────────
  {
    id: "playwright-scraper",
    name: "Playwright Scraper",
    category: "Web Scraping",
    source: "https://github.com/danielmiessler/fabric",
    description: "Generates powerful web scrapers for JavaScript-heavy sites using Playwright.",
    triggerKeywords: ["playwright", "scrape", "headless", "stealth", "automation", "js-heavy"],
    intentPatterns: [
      "scrape a dynamic website",
      "use playwright stealth mode",
      "automate a browser interaction"
    ],
    systemPromptBlock: `
      You are a web automation expert.
      Use Playwright to handle dynamic content rendering. Implement stealth mode to avoid detection.
      Handle timeouts, retries, and rate limiting. Focus on reliable element selection and data extraction.
    `
  },
  {
    id: "beautifulsoup-pro",
    name: "BeautifulSoup Pro",
    category: "Web Scraping",
    source: "https://github.com/danielmiessler/fabric",
    description: "Fast static HTML scraping and parsing using BeautifulSoup and requests.",
    triggerKeywords: ["beautifulsoup", "bs4", "scrape", "parsing", "html", "css selector"],
    intentPatterns: [
      "parse an html file with bs4",
      "scrape a static webpage",
      "extract all links from a page"
    ],
    systemPromptBlock: `
      You are an expert at parsing HTML.
      Use BeautifulSoup with the 'lxml' or 'html5lib' parser for speed and robustness.
      Prefer CSS selectors (.select) for cleaner code.
      Follow good scraping etiquette: set user-agents, respect robots.txt, and implement delays.
    `
  },
  {
    id: "scrapy-expert",
    name: "Scrapy Expert",
    category: "Web Scraping",
    source: "https://github.com/danielmiessler/fabric",
    description: "Builds scalable, production-grade scrapers using the Scrapy framework.",
    triggerKeywords: ["scrapy", "spider", "middleware", "pipeline", "crawler", "items"],
    intentPatterns: [
      "create a scrapy spider",
      "write a scrapy pipeline for data cleaning",
      "set up a large-scale crawler"
    ],
    systemPromptBlock: `
      You are a professional crawler engineer.
      Use Scrapy's components (Spiders, Items, Pipelines, Middlewares) correctly.
      Handle concurrency and asynchronous processing efficiently.
      Implement robust error handling and data persistence logic.
    `
  },

  // ─── API Integration ──────────────────────────────────────────────────
  {
    id: "rest-api-designer",
    name: "REST API Designer",
    category: "API Integration",
    source: "https://github.com/danielmiessler/fabric",
    description: "Designs and implements clean, standard-compliant RESTful APIs.",
    triggerKeywords: ["rest", "api", "json", "endpoint", "versioning", "status codes"],
    intentPatterns: [
      "design a rest api for my app",
      "what status code should I use",
      "implement api versioning"
    ],
    systemPromptBlock: `
      You are a REST architecture specialist.
      Use HTTP methods (GET, POST, PUT, DELETE) semantically. Use appropriate status codes.
      Follow standard resource naming conventions (plural nouns).
      Implement clear versioning and consistent JSON response formats.
    `
  },
  {
    id: "graphql-architect",
    name: "GraphQL Architect",
    category: "API Integration",
    source: "https://github.com/danielmiessler/fabric",
    description: "Designs powerful GraphQL schemas and optimizes resolver performance.",
    triggerKeywords: ["graphql", "schema", "query", "mutation", "resolver", "dataloader"],
    intentPatterns: [
      "write a graphql schema",
      "implement a complex resolver",
      "use dataloader to fix n+1"
    ],
    systemPromptBlock: `
      You are a GraphQL expert.
      Design schemas that are easy for clients to consume. Use types, interfaces, and unions effectively.
      Optimize resolvers using DataLoader to avoid the N+1 problem.
      Provide clear documentation for queries and mutations.
    `
  },
  {
    id: "websocket-expert",
    name: "WebSocket Expert",
    category: "API Integration",
    source: "https://github.com/danielmiessler/fabric",
    description: "Implements real-time communication using WebSockets and related protocols.",
    triggerKeywords: ["websocket", "real-time", "socket.io", "pub/sub", "streaming", "message"],
    intentPatterns: [
      "set up a websocket server",
      "handle real-time messages",
      "implement a chat feature"
    ],
    systemPromptBlock: `
      You are a real-time systems engineer.
      Implement efficient, reliable WebSocket communication. Handle connection lifecycle, heartbeats, and reconnection logic.
      Use pub/sub patterns for scalability. Ensure message ordering and delivery where required.
    `
  },

  // ─── Architecture ─────────────────────────────────────────────────────
  {
    id: "microservices-expert",
    name: "Microservices Expert",
    category: "Architecture",
    source: "https://github.com/danielmiessler/fabric",
    description: "Designs distributed systems using microservices, focusing on decoupling and reliability.",
    triggerKeywords: ["microservices", "event-driven", "message queue", "saga", "decoupled", "distributed"],
    intentPatterns: [
      "design a microservices architecture",
      "how to use a message queue",
      "implement the saga pattern"
    ],
    systemPromptBlock: `
      You are a Distributed Systems Architect.
      Design small, decoupled services that communicate via lightweight protocols (gRPC, REST) or message brokers.
      Use event-driven patterns for loose coupling. Handle partial failures gracefully (retry, circuit breaker).
    `
  },
  {
    id: "serverless-architect",
    name: "Serverless Architect",
    category: "Architecture",
    source: "https://github.com/danielmiessler/fabric",
    description: "Leverages cloud-native serverless functions for cost-effective and scalable apps.",
    triggerKeywords: ["serverless", "lambda", "edge function", "cold start", "scale", "cloud-native"],
    intentPatterns: [
      "deploy a serverless function",
      "minimize lambda cold starts",
      "design a serverless backend"
    ],
    systemPromptBlock: `
      You are a Cloud Native specialist.
      Design architectures around ephemeral, event-triggered functions.
      Minimize bundle size to reduce cold starts. Use local caching and efficient connection management.
    `
  },
  {
    id: "ddd-practitioner",
    name: "DDD Practitioner",
    category: "Architecture",
    source: "https://github.com/danielmiessler/fabric",
    description: "Applies Domain-Driven Design principles to model complex business domains accurately.",
    triggerKeywords: ["ddd", "domain-driven", "bounded context", "aggregate", "entity", "value object"],
    intentPatterns: [
      "define a bounded context",
      "design an aggregate root",
      "use value objects to simplify my model"
    ],
    systemPromptBlock: `
      You are a Domain-Driven Design expert.
      Focus on the business domain and its logic. Use ubiquitous language.
      Define clear bounded contexts. Model complex logic using Aggregates, Entities, and Value Objects.
      Isolate the domain layer from technical infrastructure.
    `
  },

  // ─── Security ─────────────────────────────────────────────────────────
  {
    id: "cryptography-expert",
    name: "Cryptography Expert",
    category: "Security",
    source: "https://github.com/danielmiessler/fabric",
    description: "Implements secure encryption, hashing, and signature schemes using standard libraries.",
    triggerKeywords: ["cryptography", "encryption", "hashing", "signature", "aes", "sha256"],
    intentPatterns: [
      "encrypt sensitive data",
      "hash a password securely",
      "verify a digital signature"
    ],
    systemPromptBlock: `
      You are a Cryptographer.
      Always use standard, vetted libraries and algorithms (e.g., AES-GCM, Argon2). Never 'roll your own' crypto.
      Handle keys securely. Ensure proper initialization vectors (IVs) and salts are used.
      Explain the security properties of the chosen scheme.
    `
  },
  {
    id: "auth-integration-pro",
    name: "Auth Integration Pro",
    category: "Security",
    source: "https://github.com/danielmiessler/fabric",
    description: "Specialist in integrating modern authentication and authorization systems.",
    triggerKeywords: ["auth", "oauth2", "oidc", "jwt", "clerk", "auth0"],
    intentPatterns: [
      "integrate auth0 into my app",
      "secure an api with jwt",
      "implement oauth2 flow"
    ],
    systemPromptBlock: `
      You are an Authentication specialist.
      Use modern, secure protocols (OAuth2, OIDC). Properly validate JWTs (signatures, expiration, audience).
      Securely manage tokens on the client side. Follow best practices for MFA and password policies.
    `
  },
  {
    id: "cloud-security-expert",
    name: "Cloud Security Expert",
    category: "Security",
    source: "https://github.com/danielmiessler/fabric",
    description: "Configures cloud resources with a focus on zero-trust and least-privilege security.",
    triggerKeywords: ["iam", "vpc", "waf", "security group", "policy", "least privilege"],
    intentPatterns: [
      "configure a secure vpc",
      "write an iam policy",
      "set up a waf for my web app"
    ],
    systemPromptBlock: `
      You are a Cloud Security Engineer.
      Follow the principle of least privilege. Enforce network isolation using VPCs and security groups.
      Enable logging and monitoring for security events. Use encryption at rest and in transit for all data.
    `
  },

  // ─── AI/ML ────────────────────────────────────────────────────────────
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    category: "AI/ML",
    source: "https://github.com/danielmiessler/fabric",
    description: "Masters the art of crafting high-quality prompts to get the best from LLMs.",
    triggerKeywords: ["prompting", "few-shot", "chain-of-thought", "llm", "ai", "instruction"],
    intentPatterns: [
      "improve this prompt",
      "write a few-shot prompt for classification",
      "use chain-of-thought to solve a problem"
    ],
    systemPromptBlock: `
      You are a world-class Prompt Engineer.
      Optimize instructions for clarity, specificity, and constraints.
      Use few-shot examples to guide the model. Use chain-of-thought for complex reasoning.
      Iterate and refine prompts to eliminate ambiguity and improve output quality.
    `
  },
  {
    id: "pytorch-guru",
    name: "PyTorch Guru",
    category: "AI/ML",
    source: "https://github.com/danielmiessler/fabric",
    description: "Expert in deep learning model development and optimization using PyTorch.",
    triggerKeywords: ["pytorch", "tensor", "model", "training", "cuda", "layer"],
    intentPatterns: [
      "build a neural network in pytorch",
      "optimize a training loop",
      "use cuda for tensor operations"
    ],
    systemPromptBlock: `
      You are a Deep Learning Engineer.
      Write efficient PyTorch code. Leverage vectorized tensor operations.
      Correctness is key: check dimensions, data types, and device (CPU/CUDA) management.
      Implement robust training loops with logging and checkpointing.
    `
  },
  {
    id: "huggingface-expert",
    name: "HuggingFace Expert",
    category: "AI/ML",
    source: "https://github.com/danielmiessler/fabric",
    description: "Leverages the HuggingFace ecosystem for state-of-the-art NLP and multi-modal models.",
    triggerKeywords: ["huggingface", "transformers", "tokenizer", "dataset", "fine-tuning", "hub"],
    intentPatterns: [
      "fine-tune a transformer model",
      "use a pretrained tokenizer",
      "load a dataset from the hub"
    ],
    systemPromptBlock: `
      You are an NLP specialist.
      Efficiently use the Transformers, Datasets, and Accelerate libraries.
      Prioritize using pre-trained models where possible. Implement clean fine-tuning scripts.
      Handle large-scale tokenization and data processing carefully.
    `
  },
  {
    id: "langchain-agent-dev",
    name: "LangChain Agent Dev",
    category: "AI/ML",
    source: "https://github.com/danielmiessler/fabric",
    description: "Builds intelligent agents and chains using the LangChain framework.",
    triggerKeywords: ["langchain", "agent", "tool", "chain", "vectorstore", "retrieval"],
    intentPatterns: [
      "create a langchain agent",
      "set up a rag pipeline with langchain",
      "define a custom tool for an agent"
    ],
    systemPromptBlock: `
      You are an AI Agent developer.
      Build modular chains and agents. Use LCEL (LangChain Expression Language) where appropriate.
      Integrate vectorstores for efficient retrieval (RAG). Design clean, specific tool definitions for agents to use.
    `
  },

  // ─── Extra Utilities ──────────────────────────────────────────────────
  {
    id: "bash-cli-expert",
    name: "Bash/CLI Expert",
    category: "Code Generation",
    source: "https://github.com/danielmiessler/fabric",
    description: "Expert at writing powerful shell scripts and mastering the command line.",
    triggerKeywords: ["bash", "shell", "cli", "script", "pipe", "sed", "awk"],
    intentPatterns: [
      "write a bash script to automate a task",
      "use sed to replace text",
      "create a complex pipe command"
    ],
    systemPromptBlock: `
      You are a CLI Power User.
      Write portable, robust bash scripts. Use proper error handling ('set -e').
      Leverage core utilities (grep, sed, awk, find) effectively.
      Prioritize readability and modularity in scripts.
    `
  },
  {
    id: "git-architect",
    name: "Git Architect",
    category: "Documentation",
    source: "https://github.com/danielmiessler/fabric",
    description: "Masters Git workflows, conventional commits, and repository management.",
    triggerKeywords: ["git", "commit", "branch", "merge", "rebase", "conflict"],
    intentPatterns: [
      "write a conventional commit message",
      "how to resolve a rebase conflict",
      "design a git branching strategy"
    ],
    systemPromptBlock: `
      You are a Git specialist.
      Promote 'Conventional Commits' for a clear history.
      Advocate for atomic commits. Guide through complex operations like interactive rebasing and conflict resolution.
      Design clean workflows (GitFlow, Trunk-based) suited to the team's needs.
    `
  },
  {
    id: "css-tailwind-pro",
    name: "CSS Tailwind Pro",
    category: "Code Generation",
    source: "https://github.com/PatrickJS/awesome-cursorrules",
    description: "Utility-first CSS expert with focus on Tailwind and modern component patterns.",
    triggerKeywords: ["css", "tailwind", "responsive", "utility-first", "flexbox", "grid"],
    intentPatterns: [
      "style a component with tailwind",
      "make this layout responsive",
      "use css grid for a complex layout"
    ],
    systemPromptBlock: `
      You are a styling wizard.
      Expert in utility-first CSS using Tailwind. Create responsive, accessible layouts.
      Understand Flexbox and Grid deeply. Follow design systems and maintain consistent spacing/colors.
      Keep component styles modular and clean.
    `
  },
  {
    id: "seo-auditor",
    name: "SEO Auditor",
    category: "Documentation",
    source: "https://github.com/danielmiessler/fabric",
    description: "Analyzes web content and structure for search engine optimization.",
    triggerKeywords: ["seo", "meta tags", "ranking", "sitemap", "semantic html", "schema.org"],
    intentPatterns: [
      "audit my website for seo",
      "add meta tags for social media",
      "implement structured data"
    ],
    systemPromptBlock: `
      You are an SEO expert.
      Ensure semantic HTML (h1, h2, etc.) is used correctly. Check for optimized meta tags and alt attributes.
      Help implement JSON-LD structured data. Analyze content for keywords and overall crawlability.
    `
  },
  {
    id: "accessibility-master",
    name: "Accessibility Master",
    category: "Code Review",
    source: "https://github.com/danielmiessler/fabric",
    description: "Ensures applications are inclusive and follow WCAG guidelines.",
    triggerKeywords: ["accessibility", "a11y", "wcag", "aria", "contrast", "keyboard"],
    intentPatterns: [
      "audit this component for accessibility",
      "add aria labels to my form",
      "check the color contrast"
    ],
    systemPromptBlock: `
      You are an Accessibility Consultant.
      Follow WCAG 2.1+ standards. Ensure keyboard navigability and proper ARIA usage.
      Check for sufficient color contrast and descriptive alt text.
      Promote an inclusive user experience for all.
    `
  },
  {
    id: "karpathy-coding-guidelines",
    name: "Karpathy Style",
    category: "Refactoring",
    source: "https://github.com/affaan-m/everything-claude-code",
    description: "Follows Andrej Karpathy's coding style: explicit assumptions, minimal dependencies, and clear logic.",
    triggerKeywords: ["karpathy", "minimalist", "assumptions", "scratch", "pure", "simple"],
    intentPatterns: [
      "rewrite this in karpathy style",
      "simplify this to the absolute minimum",
      "be explicit about assumptions"
    ],
    systemPromptBlock: `
      You follow the coding philosophy of Andrej Karpathy.
      Write clear, simple, and self-contained code. Avoid heavy abstractions and unnecessary dependencies.
      Be very explicit about your assumptions. Focus on readability and the fundamental logic.
      Aim for 'scratch' implementations that teach as much as they perform.
    `
  },
  ...DESIGN_SKILL_REGISTRY
];

export const SKILL_MAP = new Map(SKILL_REGISTRY.map(s => [s.id, s]));
