<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AGENTS Contract

## Steering Documents
- Use `.codex/steering/product.md`, `.codex/steering/tech.md`, `.codex/steering/structure.md` as the authoritative sources for product, technical, and structural rules; summarize them only by reference.
- Access Steering paths via `ConfigManager.getPath("steering")`; avoid hardcoding `.codex/steering` strings outside existing helpers.
- Treat Steering files as read-only; invoke `SteeringManager` workflows for any additions, refinements, or deletions.
- Cite the specific Steering file and (when relevant) section headers in deliverables instead of copying their contents.

## Decision Precedence
1) Steering documents under `.codex/steering/*.md`.
2) This AGENTS contract.
3) Explicit user instructions.
4) Generic assumptions (use only when none of the above apply).

## Agent Behavior Contract
- Use `SpecManager` (`src/features/spec/spec-manager.ts`) and `SteeringManager` (`src/features/steering/steering-manager.ts`) for lifecycle operations; do not reimplement their logic.
- Route prompts through `PromptLoader` (`src/services/prompt-loader.ts`) and `CodexProvider` (`src/providers/codex-provider.ts`) instead of spawning unmanaged terminals or reading prompt files directly.
- Respect feature gating and configuration resolved by `ConfigManager` (`src/utils/config-manager.ts`); update workspace settings via its APIs rather than manual file edits.
- Prefer shared utilities in `src/utils/*` for notifications, chat integration, and configuration; avoid bespoke implementations.
- Keep logging scoped to the provided output channel (`outputChannel` from `src/extension.ts`) and avoid excessive noise.

## Paths & I/O
- Use VS Code `workspace.fs` APIs and helper managers for filesystem changes; avoid raw `fs` calls unless already sanctioned in the module you touch.
- Keep generated artifacts inside `.codex/`, `dist/`, or other documented output folders; do not write outside the workspace root.
- Preserve the `.codex/tmp` contract for transient prompt payloads; clean up after asynchronous Codex interactions by mirroring existing patterns.
- Verify that steering files exist before reading or referencing them, mirroring `SteeringManager.getSteeringDocuments()`.

## CLI Integration
- Invoke Codex actions through `CodexProvider.invokeCodexSplitView` or `invokeCodexHeadless`; do not bypass these abstractions.
- Confirm required tooling (Codex CLI, VS Code) using existing availability checks before calling commands.
- When adding commands, expose them via `package.json` contributions and register through `registerCommands` in `src/extension.ts`.

## Submission Checklist
- Confirm guidance from `.codex/steering/*.md` and reference, do not restate.
- Use `ConfigManager` and manager classes for steering/spec paths.
- Route Codex interactions through `CodexProvider`/`PromptLoader`.
- Limit edits to approved workspace directories; avoid overwriting Steering files.
- Document any deviations from Steering in the deliverable with explicit justification.

## Non-Goals / Anti-Patterns
- Do not bypass manager/provider singletons (`PromptLoader`, `CodexProvider`, `ConfigManager`) or instantiate duplicates.
- Do not duplicate Steering content, constants, or prompt templates in new files.
- Do not execute build or CLI commands with hardcoded absolute paths or environment assumptions.
- Do not re-enable retired features or commands without explicit authorization in Steering or user instructions.
