## 1. Implementation
- [ ] 1.1 Add a `CreateSteeringInputController` (or equivalent) that opens the custom steering dialog webview, manages draft persistence, and formats submission payloads for the `create-custom-steering` prompt.
- [ ] 1.2 Wire `SteeringManager.createCustom` to the new controller and update extension activation wiring plus unit tests for the new workflow.
- [ ] 1.3 Build the `create-steering` React view with multi-field form, autosave, and close-confirmation parity with the Create New Spec experience.
- [ ] 1.4 Add Vitest coverage for the controller and webview bridge logic, ensuring draft persistence, validation, and submission behaviors.

## 2. Validation
- [ ] 2.1 Manually verify the command in VS Code, including draft recovery, submission success path, and cancel flow with unsaved changes.
- [ ] 2.2 Run `npm run lint`, `npm run test`, and `npm run check` to confirm steering changes respect project and steering contracts.
