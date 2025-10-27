## Why
- The current `create custom steering` command asks for input through the VS Code input box, which limits context sharing, provides no autosave, and diverges from the richer Create New Spec experience.
- Users want a consistent large-form editor with draft recovery so they can describe steering guidance in depth before sending prompts to Codex.

## What Changes
- Add a dedicated custom steering dialog webview that mirrors the Create New Spec flow, including focus management, autosave, and close-confirmation behavior.
- Introduce a steering creation input controller that formats the multi-field form data into the existing `create-custom-steering` prompt payload.
- Update `SteeringManager.createCustom` and related tests to invoke the new controller while keeping prompt rendering via `PromptLoader` per `.codex/steering/tech.md` integration rules.
- Extend the webview bundle with a `create-steering` page, React form components, and bridge message types needed for submission, autosave, and cancellation.

## Impact
- Improves usability and parity between spec creation and steering creation workflows.
- Keeps steering prompts aligned with manager/provider abstractions defined in `.codex/steering/structure.md` without bypassing shared utilities.
- Requires new UI strings and tests but no migrations or schema updates.
