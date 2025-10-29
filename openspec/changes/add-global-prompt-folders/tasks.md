## 1. Implementation
- [ ] 1.1 Enhance the Prompts tree provider to emit `Project` and `Global` group nodes while preserving existing context commands.
- [ ] 1.2 Update the prompt discovery service to resolve platform-specific global prompt directories and mark each prompt item with its source metadata.
- [ ] 1.3 Add unit coverage for tree grouping and discovery logic, including scenarios where the global prompt directory is missing.

## 2. Validation
- [ ] 2.1 Manually verify the Prompts view on Linux/macOS and Windows, confirming both groups render when directories exist and that empty groups collapse gracefully.
- [ ] 2.2 Run `npm run lint`, `npm run test`, and `npm run check` to ensure the change respects steering and project quality gates.
