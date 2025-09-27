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

import { relative } from "path";
import { VSC_CONFIG_NAMESPACE } from "../constants";
import { ConfigManager } from "../utils/config-manager";

export class SpecTaskCodeLensProvider implements CodeLensProvider {
	private readonly _onDidChangeCodeLenses: EventEmitter<void> =
		new EventEmitter<void>();
	readonly onDidChangeCodeLenses: Event<void> =
		this._onDidChangeCodeLenses.event;
	private readonly configManager: ConfigManager;

	constructor() {
		this.configManager = ConfigManager.getInstance();
		workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration(VSC_CONFIG_NAMESPACE)) {
				// biome-ignore lint/complexity/noVoid: ignore
				void this.configManager.loadSettings();
			}
			this._onDidChangeCodeLenses.fire();
		});
	}

	provideCodeLenses(
		document: TextDocument,
		token: CancellationToken
	): CodeLens[] | Thenable<CodeLens[]> {
		if (!this.isSpecTaskDocument(document)) {
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
					command: "kiro-codex-ide.spec.implTask",
					arguments: [document.uri, i, taskDescription],
				});

				codeLenses.push(codeLens);
			}
		}

		return codeLenses;
	}

	private isSpecTaskDocument(document: TextDocument): boolean {
		if (!document.fileName.endsWith("tasks.md")) {
			return false;
		}

		try {
			const specBasePath = this.configManager.getAbsolutePath("specs");
			const relativePath = relative(specBasePath, document.uri.fsPath);
			if (!relativePath || relativePath.startsWith("..")) {
				return false;
			}
			return true;
		} catch (error) {
			return false;
		}
	}

	resolveCodeLens(codeLens: CodeLens, token: CancellationToken) {
		return codeLens;
	}
}
