import { join } from "path";
import {
	FileType,
	type OutputChannel,
	ProgressLocation,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";
import type { CodexProvider } from "../../providers/codex-provider";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { NotificationUtils } from "../../utils/notification-utils";

export class SteeringManager {
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

	getSteeringBasePath(): string {
		return this.configManager.getPath("steering");
	}

	async createCustom() {
		// Get project context and guidance needs
		const description = await window.showInputBox({
			title: "📝 Create Steering Document 📝",
			prompt: "Describe what guidance you need for your project",
			placeHolder:
				"e.g., API design patterns for REST endpoints, testing strategy for React components",
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

		// Create steering directory if it doesn't exist
		const steeringPath = join(
			workspaceFolder.uri.fsPath,
			this.getSteeringBasePath()
		);

		try {
			// Ensure directory exists
			await workspace.fs.createDirectory(Uri.file(steeringPath));

			// Let Codex decide the filename based on the description
			const prompt = this.promptLoader.renderPrompt("create-custom-steering", {
				description,
				steeringPath: this.getSteeringBasePath(),
			});

			await this.codexProvider.invokeCodexSplitView(
				prompt,
				"KFC - Create Steering"
			);

			// Show auto-dismiss notification
			await NotificationUtils.showAutoDismissNotification(
				"Codex is creating a steering document based on your needs. Check the terminal for progress."
			);
		} catch (error) {
			window.showErrorMessage(`Failed to create steering document: ${error}`);
		}
	}

	/**
	 * Delete a steering document and update AGENTS.md.md
	 */
	async delete(
		documentName: string,
		documentPath: string
	): Promise<{ success: boolean; error?: string }> {
		try {
			// First delete the file
			await workspace.fs.delete(Uri.file(documentPath));

			// Load and render the delete prompt
			const prompt = this.promptLoader.renderPrompt("delete-steering", {
				documentName,
				steeringPath: this.getSteeringBasePath(),
			});

			// Show progress notification
			await NotificationUtils.showAutoDismissNotification(
				`Deleting "${documentName}" and updating AGENTS.md.md...`
			);

			// Execute Codex command to update AGENTS.md.md
			const result = await this.codexProvider.invokeCodexHeadless(prompt);

			if (result.exitCode === 0) {
				await NotificationUtils.showAutoDismissNotification(
					`Steering document "${documentName}" deleted and AGENTS.md.md updated successfully.`
				);
				return { success: true };
			}
			if (result.exitCode !== undefined) {
				const error = `Failed to update AGENTS.md.md. Exit code: ${result.exitCode}`;
				this.outputChannel.appendLine(`[Steering] ${error}`);
				return { success: false, error };
			}
			return { success: true }; // Assume success if no exit code
		} catch (error) {
			const errorMsg = `Failed to delete steering document: ${error}`;
			this.outputChannel.appendLine(`[Steering] ${errorMsg}`);
			return { success: false, error: errorMsg };
		}
	}

	/**
	 * Generate initial steering documents by analyzing the project
	 */
	async init() {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		// Check if steering documents already exist
		const existingDocs = await this.getSteeringDocuments();
		if (existingDocs.length > 0) {
			const existingNames = existingDocs.map((doc) => doc.name).join(", ");
			const confirm = await window.showWarningMessage(
				`Steering documents already exist (${existingNames}). Init steering will analyze the project again but won't overwrite existing files.`,
				"Continue",
				"Cancel"
			);
			if (confirm !== "Continue") {
				return;
			}
		}

		// Create steering directory if it doesn't exist
		const steeringPath = join(
			workspaceFolder.uri.fsPath,
			this.getSteeringBasePath()
		);
		await workspace.fs.createDirectory(Uri.file(steeringPath));

		// Generate steering documents using Codex
		await window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: "Analyzing project and generating steering documents...",
				cancellable: false,
			},
			async () => {
				const prompt = this.promptLoader.renderPrompt("init-steering", {
					steeringPath: this.getSteeringBasePath(),
				});

				await this.codexProvider.invokeCodexSplitView(
					prompt,
					"KFC - Init Steering"
				);

				// Auto-dismiss notification after 3 seconds
				await NotificationUtils.showAutoDismissNotification(
					"Steering documents generation started. Check the terminal for progress."
				);
			}
		);
	}

	async refine(uri: Uri) {
		// Load and render the refine prompt
		const prompt = this.promptLoader.renderPrompt("refine-steering", {
			filePath: uri.fsPath,
		});

		// Send to Codex
		await this.codexProvider.invokeCodexSplitView(
			prompt,
			"KFC - Refine Steering"
		);

		// Show auto-dismiss notification
		await NotificationUtils.showAutoDismissNotification(
			"Codex is refining the steering document. Check the terminal for progress."
		);
	}

	async getSteeringDocuments(): Promise<Array<{ name: string; path: string }>> {
		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			return [];
		}

		const steeringPath = join(
			workspaceFolder.uri.fsPath,
			this.getSteeringBasePath()
		);

		try {
			const entries = await workspace.fs.readDirectory(Uri.file(steeringPath));
			return entries
				.filter(
					([name, type]) => type === FileType.File && name.endsWith(".md")
				)
				.map(([name]) => ({
					name: name.replace(".md", ""),
					path: join(steeringPath, name),
				}));
		} catch (error) {
			// Directory doesn't exist yet
			return [];
		}
	}

	/**
	 * Create project-level AGENTS.md.md file using Codex CLI
	 */

	// biome-ignore lint/suspicious/useAwait: ignore
	async createProjectCodexMd() {
		const terminal = window.createTerminal({
			name: "Codex Code - Init",
			cwd: workspace.workspaceFolders?.[0]?.uri.fsPath,
			location: {
				viewColumn: ViewColumn.Two,
			},
		});
		terminal.show();

		// Wait for Python extension to finish venv activation
		const delay = this.configManager.getTerminalDelay();
		setTimeout(() => {
			terminal.sendText('codex --permission-mode bypassPermissions "/init"');
		}, delay);
	}

	/**
	 * Create global AGENTS.md.md file in user's home directory
	 */
	async createUserCodexMd() {
		const codexDir = join(process.env.HOME || "", ".codex");
		const filePath = join(codexDir, "AGENTS.md.md");

		// Ensure directory exists
		try {
			await workspace.fs.createDirectory(Uri.file(codexDir));
		} catch (error) {
			// Directory might already exist
		}

		// Check if file already exists
		try {
			await workspace.fs.stat(Uri.file(filePath));
			const overwrite = await window.showWarningMessage(
				"Global AGENTS.md.md already exists. Overwrite?",
				"Overwrite",
				"Cancel"
			);
			if (overwrite !== "Overwrite") {
				return;
			}
		} catch {
			// File doesn't exist, continue
		}

		// Create empty file
		const initialContent = "";
		await workspace.fs.writeFile(
			Uri.file(filePath),
			Buffer.from(initialContent)
		);

		// Open the file
		const document = await workspace.openTextDocument(filePath);
		await window.showTextDocument(document);

		// Auto-dismiss notification
		await NotificationUtils.showAutoDismissNotification(
			"Created global AGENTS.md.md file"
		);
	}
}
