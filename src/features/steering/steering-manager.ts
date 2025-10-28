import { homedir } from "os";
import { join } from "path";
import {
	FileType,
	type ExtensionContext,
	type OutputChannel,
	ProgressLocation,
	Uri,
	ViewColumn,
	window,
	workspace,
} from "vscode";
import type { CodexProvider } from "../../providers/codex-provider";
import { PromptLoader } from "../../services/prompt-loader";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { ConfigManager } from "../../utils/config-manager";
import { NotificationUtils } from "../../utils/notification-utils";
import { CreateSteeringInputController } from "./create-steering-input-controller";

export class SteeringManager {
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly codexProvider: CodexProvider;
	private readonly outputChannel: OutputChannel;
	private readonly createSteeringInputController: CreateSteeringInputController;

	constructor(
		context: ExtensionContext,
		codexProvider: CodexProvider,
		outputChannel: OutputChannel
	) {
		this.configManager = ConfigManager.getInstance();
		this.configManager.loadSettings();
		this.promptLoader = PromptLoader.getInstance();
		this.codexProvider = codexProvider;
		this.outputChannel = outputChannel;
		this.createSteeringInputController = new CreateSteeringInputController({
			context,
			configManager: this.configManager,
			promptLoader: this.promptLoader,
			outputChannel: this.outputChannel,
		});
	}

	getSteeringBasePath(): string {
		return this.configManager.getPath("steering");
	}

	async createCustom() {
		try {
			await this.createSteeringInputController.open();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to open Create Steering dialog";
			this.outputChannel.appendLine(
				`[SteeringManager] Failed to open Create Steering dialog: ${message}`
			);
			window.showErrorMessage(
				`Failed to open Create Steering dialog: ${message}`
			);
		}
	}

	/**
	 * Delete a steering document and update AGENTS.md
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
				`Deleting "${documentName}" and updating AGENTS.md...`
			);

			// Execute Codex command to update AGENTS.md
			const result = await this.codexProvider.invokeCodexHeadless(prompt);

			if (result.exitCode === 0) {
				await NotificationUtils.showAutoDismissNotification(
					`Steering document "${documentName}" deleted and AGENTS.md updated successfully.`
				);
				return { success: true };
			}
			if (result.exitCode !== undefined) {
				const error = `Failed to update AGENTS.md. Exit code: ${result.exitCode}`;
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

		// Generate steering documents via chat
		await window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: "Preparing steering analysis prompt for ChatGPT...",
				cancellable: false,
			},
			async () => {
				const prompt = this.promptLoader.renderPrompt("init-steering", {
					steeringPath: this.getSteeringBasePath(),
				});

				await sendPromptToChat(prompt);

				await NotificationUtils.showAutoDismissNotification(
					"Sent the steering initialization prompt to ChatGPT. Review the chat for next steps."
				);
			}
		);
	}

	async refine(uri: Uri) {
		// Load and render the refine prompt
		const prompt = this.promptLoader.renderPrompt("refine-steering", {
			filePath: uri.fsPath,
		});

		await sendPromptToChat(prompt);

		await NotificationUtils.showAutoDismissNotification(
			"Sent the steering refinement prompt to ChatGPT. Continue collaborating there."
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
	 * Create project-level AGENTS.md file using Codex CLI
	 */

	// biome-ignore lint/suspicious/useAwait: ignore
	async createProjectCodexMd() {
		const terminal = window.createTerminal({
			name: "Codex - Init",
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
	 * Create global AGENTS.md file in user's home directory
	 */
	async createUserCodexMd() {
		const homeDir =
			homedir() || process.env.USERPROFILE || process.env.HOME || "";
		const codexDir = join(homeDir, ".codex");
		const filePath = join(codexDir, "AGENTS.md");

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
				"Global AGENTS.md already exists. Overwrite?",
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

		await NotificationUtils.showAutoDismissNotification(
			"Created global AGENTS.md file"
		);
	}
	/**
	 * Create global Codex configuration file (~/.codex/AGENTS.md)
	 */
	async createUserConfiguration() {
		const homeDir = homedir() || process.env.USERPROFILE || "";
		const codexDir = join(homeDir, ".codex");
		const filePath = join(codexDir, "AGENTS.md");

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
				"Global configuration file (~/.codex/AGENTS.md) already exists. Overwrite?",
				"Overwrite",
				"Cancel"
			);
			if (overwrite !== "Overwrite") {
				return;
			}
		} catch {
			// File doesn't exist, continue
		}

		// Create initial MD content for Codex CLI
		const initialContent = `This file controls default behavior for Codex CLI across all projects.
`;

		await workspace.fs.writeFile(
			Uri.file(filePath),
			Buffer.from(initialContent)
		);

		const document = await workspace.openTextDocument(filePath);
		await window.showTextDocument(document, {
			preview: false,
			viewColumn: ViewColumn.Active,
		});
	}

	/**
	 * Create project-level AGENTS.md file using Codex CLI
	 */
	async createProjectDocumentation() {
		try {
			const prompt = this.promptLoader.renderPrompt("create-agents-md", {
				steeringPath: this.getSteeringBasePath(),
			});

			await sendPromptToChat(prompt);

			await NotificationUtils.showAutoDismissNotification(
				"Sent the AGENTS.md creation prompt to ChatGPT. Follow the conversation to finalize it."
			);
		} catch (error) {
			window.showErrorMessage(`Failed to create AGENTS.md: ${error}`);
		}
	}
}
