import { dirname, join } from "path";
import {
	FileType,
	type ExtensionContext,
	type OutputChannel,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { NotificationUtils } from "../../utils/notification-utils";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { CreateSpecInputController } from "./create-spec-input-controller";

export type SpecDocumentType = "requirements" | "design" | "tasks";

export class SpecManager {
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly outputChannel: OutputChannel;
	private readonly createSpecInputController: CreateSpecInputController;

	constructor(context: ExtensionContext, outputChannel: OutputChannel) {
		this.configManager = ConfigManager.getInstance();
		this.configManager.loadSettings();
		this.promptLoader = PromptLoader.getInstance();
		this.outputChannel = outputChannel;
		this.createSpecInputController = new CreateSpecInputController({
			context,
			configManager: this.configManager,
			promptLoader: this.promptLoader,
			outputChannel: this.outputChannel,
		});
	}

	getSpecBasePath(): string {
		return this.configManager.getPath("specs");
	}

	async create() {
		try {
			await this.createSpecInputController.open();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unable to open spec dialog";
			this.outputChannel.appendLine(
				`[SpecManager] Failed to open Create Spec dialog: ${message}`
			);
			window.showErrorMessage(`Failed to open Create Spec dialog: ${message}`);
		}
	}

	async navigateToDocument(specName: string, type: SpecDocumentType) {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return;
		}

		const docPath = join(
			workspaceFolder.uri.fsPath,
			this.getSpecBasePath(),
			specName,
			`${type}.md`
		);

		try {
			const doc = await workspace.openTextDocument(docPath);
			await window.showTextDocument(doc);
		} catch (error) {
			// File doesn't exist, look for already open virtual documents
			// Create unique identifier for this spec document
			const uniqueMarker = `<!-- kiro-spec: ${specName}/${type} -->`;

			for (const doc of workspace.textDocuments) {
				// Check if this is an untitled document with our unique marker
				if (doc.isUntitled && doc.getText().includes(uniqueMarker)) {
					// Found our specific virtual document, show it
					await window.showTextDocument(doc, {
						preview: false,
						viewColumn: ViewColumn.Active,
					});
					return;
				}
			}

			// No existing virtual document found, create a new one
			let placeholderContent = `${uniqueMarker}
# ${type.charAt(0).toUpperCase() + type.slice(1)} Document

This document has not been created yet.`;

			if (type === "design") {
				placeholderContent +=
					"\n\nPlease approve the requirements document first.";
			} else if (type === "tasks") {
				placeholderContent += "\n\nPlease approve the design document first.";
			} else if (type === "requirements") {
				placeholderContent +=
					'\n\nRun "Create New Spec" to generate this document.';
			}

			// Create a new untitled document
			const doc = await workspace.openTextDocument({
				content: placeholderContent,
				language: "markdown",
			});

			// Show it
			await window.showTextDocument(doc, {
				preview: false,
				viewColumn: ViewColumn.Active,
			});
		}
	}

	async delete(specName: string): Promise<void> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		const specPath = join(
			workspaceFolder.uri.fsPath,
			this.getSpecBasePath(),
			specName
		);

		try {
			await workspace.fs.delete(Uri.file(specPath), {
				recursive: true,
			});
			await NotificationUtils.showAutoDismissNotification(
				`Spec "${specName}" deleted successfully`
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[SpecManager] Failed to delete spec: ${error}`
			);
			window.showErrorMessage(`Failed to delete spec: ${error}`);
		}
	}

	async getSpecList(): Promise<string[]> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return [];
		}

		const specsPath = join(workspaceFolder.uri.fsPath, this.getSpecBasePath());

		// Check if directory exists first before creating
		try {
			await workspace.fs.stat(Uri.file(specsPath));
		} catch {
			// Directory doesn't exist, create it
			try {
				this.outputChannel.appendLine(
					"[SpecManager] Creating .codex/specs directory"
				);
				await workspace.fs.createDirectory(Uri.file(dirname(specsPath)));
				await workspace.fs.createDirectory(Uri.file(specsPath));
			} catch {
				// Ignore errors
			}
		}

		try {
			const entries = await workspace.fs.readDirectory(Uri.file(specsPath));
			return entries
				.filter(([, type]) => type === FileType.Directory)
				.map(([name]) => name);
		} catch (error) {
			// Directory doesn't exist yet
			return [];
		}
	}

	async implTask(taskFilePath: string, taskDescription: string) {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		// Show notification immediately after user input
		const prompt = this.promptLoader.renderPrompt("impl-task", {
			taskFilePath,
			taskDescription,
			workingDirectory: workspaceFolder.uri.fsPath,
		});

		await sendPromptToChat(prompt);

		NotificationUtils.showAutoDismissNotification(
			"Sent the implementation task prompt to ChatGPT. Follow up there."
		);
	}
}
