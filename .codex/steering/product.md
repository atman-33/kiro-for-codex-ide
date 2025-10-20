# Product Guidance

- Recognize **Kiro for Codex IDE** as a VS Code extension that orchestrates spec-driven workflows for Codex CLI users; always keep the focus on managing `.codex/specs`, `.codex/steering`, and `.codex/prompts` assets surfaced through the tree views (`src/providers/*-explorer-provider.ts`).
- Emphasize the trio of core features: guided spec generation (`SpecManager` in `src/features/spec/spec-manager.ts`), steering document lifecycle automation (`SteeringManager` in `src/features/steering/steering-manager.ts`), and reusable prompt execution (`PromptsExplorerProvider` in `src/providers/prompts-explorer-provider.ts`).
- Preserve the user value proposition of keeping Codex chat in sync with workspace artifacts: route creation/refinement actions through prompt templates compiled by `PromptLoader` so Codex receives structured context rather than ad-hoc messages.
- Guard the business rule that spec documents follow the Requirements → Design → Tasks flow; do not surface design or task guidance until the prerequisite documents exist (see placeholders built in `SpecManager.navigateToDocument`).
- Maintain the rule that steering operations must never overwrite existing files silently; reuse `SteeringManager.init()` semantics that skip regeneration when `.codex/steering/*.md` already exists and rely on Codex chat for refinements.
- When deleting specs or steering docs, trigger the corresponding manager methods so `.codex` directories stay tidy and AGENTS.md remains in sync (use `SteeringManager.delete()` to route AGENTS updates through headless Codex execution).
