import {
	type CancellationToken,
	CodeLens,
	type CodeLensProvider,
	type Event,
	EventEmitter,
	Range,
	type TextDocument,
	workspace,
} from "vscode";

export class SpecTaskCodeLensProvider implements CodeLensProvider {
	private readonly _onDidChangeCodeLenses: EventEmitter<void> =
		new EventEmitter<void>();
	readonly onDidChangeCodeLenses: Event<void> =
		this._onDidChangeCodeLenses.event;

	constructor() {
		workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});
	}

	provideCodeLenses(
		document: TextDocument,
		token: CancellationToken
	): CodeLens[] | Thenable<CodeLens[]> {
		// Pattern is already filtered by registration, but double-check for tasks.md
		if (
			!(
				document.fileName.includes(".codex/specs/") ||
				document.fileName.endsWith("tasks.md")
			)
		) {
			return [];
		}

		const codeLenses: CodeLens[] = [];
		const text = document.getText();
		// Use regex split to handle both Windows (CRLF) and Unix (LF) line endings
		// biome-ignore lint/performance/useTopLevelRegex: ignore
		const lines = text.split(/\r?\n/);

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			// Match task list format: - [ ] task description
			// biome-ignore lint/performance/useTopLevelRegex: ignore
			const taskMatch = line.match(/^(\s*)- \[ \] (.+)$/);

			if (taskMatch) {
				const range = new Range(i, 0, i, line.length);
				const taskDescription = taskMatch[2];

				// Create CodeLens
				const codeLens = new CodeLens(range, {
					title: "$(play) Start Task",
					tooltip: "Click to execute this task",
					command: "kiroCodex.spec.implTask",
					arguments: [document.uri, i, taskDescription],
				});

				codeLenses.push(codeLens);
			}
		}

		return codeLenses;
	}

	resolveCodeLens(codeLens: CodeLens, token: CancellationToken) {
		return codeLens;
	}
}
