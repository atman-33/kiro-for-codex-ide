## ADDED Requirements
### Requirement: Prompt Source Grouping
The Prompts tree MUST organize prompt items under `Project` and `Global` group nodes.

#### Scenario: Render project and global groups
- **GIVEN** a workspace that contains `.codex/prompts` files and the user has global prompts available
- **WHEN** the Prompts view is opened in the sidebar
- **THEN** the tree shows a `Project` group containing project prompts and a `Global` group containing the global prompts

### Requirement: Resolve Global Prompt Directory
The extension MUST locate the platform-specific global prompt directory when populating the Prompts view.

#### Scenario: Detect platform-specific directory
- **GIVEN** the user is running on Linux, macOS, or Windows with a `.codex/prompts` folder in their home directory
- **WHEN** the Prompts view loads prompt data
- **THEN** the extension reads prompts from the appropriate global path for the current platform and lists them under the `Global` group
