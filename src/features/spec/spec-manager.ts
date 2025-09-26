import { basename, dirname, join } from "path";
import {
	type Disposable,
	type FileSystemWatcher,
	FileType,
	type OutputChannel,
	RelativePattern,
	type Terminal,
	Uri,
	ViewColumn,
	window,
	workspace,
	type WorkspaceFolder,
} from "vscode";
import type { CodexProvider } from "../../providers/codex-provider";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { NotificationUtils } from "../../utils/notification-utils";

export type SpecDocumentType = "requirements" | "design" | "tasks";

export class SpecManager {
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly codexProvider: CodexProvider;
	private readonly outputChannel: OutputChannel;

	constructor(codexProvider: CodexProvider, outputChannel: OutputChannel) {
		this.configManager = ConfigManager.getInstance();
		this.configManager.loadSettings();
		this.promptLoader = PromptLoader.getInstance();
		this.codexProvider = codexProvider;
		this.outputChannel = outputChannel;
	}

	getSpecBasePath(): string {
		return this.configManager.getPath("specs");
	}

	async create() {
		// Get feature description only
		const description = await window.showInputBox({
			title: "✨ Create New Spec ✨",
			prompt:
				"Specs are a structured way to build features so you can plan before building",
			placeHolder:
				"Enter your idea to generate requirement, design, and task specs...",
			ignoreFocusOut: false,
		});

		if (!description) {
			return;
		}

		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		// Show notification immediately after user input
		NotificationUtils.showAutoDismissNotification(
			"Codex is creating your spec. Check the terminal for progress."
		);

		// Let Codex handle everything - directory creation, naming, and file creation
		// Load and render the spec creation prompt
		const prompt = this.promptLoader.renderPrompt("create-spec", {
			description,
			workspacePath: workspaceFolder.uri.fsPath,
			specBasePath: this.getSpecBasePath(),
		});

		// Send to Codex and get the terminal
		const terminal = await this.codexProvider.invokeCodexSplitView(
			prompt,
			"KFC - Creating Spec"
		);

		// Set up automatic terminal renaming when spec folder is created
		this.setupSpecFolderWatcher(workspaceFolder, terminal);
	}

	/**
	 * Set up a file system watcher to automatically rename the terminal
	 * when a new spec folder is created
	 */

	// biome-ignore lint/suspicious/useAwait: ignore
	private async setupSpecFolderWatcher(
		workspaceFolder: WorkspaceFolder,
		terminal: Terminal
	): Promise<void> {
		// Create watcher for new folders in the specs directory
		const watcher = workspace.createFileSystemWatcher(
			new RelativePattern(workspaceFolder, `${this.getSpecBasePath()}/*`),
			false, // Watch for creates
			true, // Ignore changes
			true // Ignore deletes
		);

		let disposed = false;

		// Handle folder creation
		const disposable = watcher.onDidCreate(async (uri) => {
			if (disposed) {
				return;
			}

			// Validate it's a directory
			try {
				const stats = await workspace.fs.stat(uri);
				if (stats.type !== FileType.Directory) {
					this.outputChannel.appendLine(
						`[SpecManager] Skipping non-directory: ${uri.fsPath}`
					);
					return;
				}
			} catch (error) {
				this.outputChannel.appendLine(
					`[SpecManager] Error checking path: ${error}`
				);
				return;
			}

			const specName = basename(uri.fsPath);
			this.outputChannel.appendLine(
				`[SpecManager] New spec detected: ${specName}`
			);
			try {
				await this.codexProvider.renameTerminal(terminal, `Spec: ${specName}`);
			} catch (error) {
				this.outputChannel.appendLine(
					`[SpecManager] Failed to rename terminal: ${error}`
				);
			}

			// Clean up after successful rename
			this.disposeWatcher(disposable, watcher);
			disposed = true;
		});

		// Auto-cleanup after timeout
		setTimeout(() => {
			if (!disposed) {
				this.outputChannel.appendLine(
					"[SpecManager] Watcher timeout - cleaning up"
				);
				this.disposeWatcher(disposable, watcher);
				disposed = true;
			}
			// biome-ignore lint/style/noMagicNumbers: ignore
		}, 60_000); // 60 seconds timeout
	}

	/**
	 * Dispose watcher and its event handler
	 */
	private disposeWatcher(
		disposable: Disposable,
		watcher: FileSystemWatcher
	): void {
		disposable.dispose();
		watcher.dispose();
		this.outputChannel.appendLine("[SpecManager] Watcher disposed");
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
}
