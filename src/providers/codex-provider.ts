import { promises } from "fs";
import { join } from "path";
import {
	type ExtensionContext,
	type OutputChannel,
	type Terminal,
	ViewColumn,
	commands,
	window,
	workspace,
} from "vscode";
import { VSC_CONFIG_NAMESPACE } from "../constants";
import { ConfigManager } from "../utils/config-manager";

export type CodexAvailabilityResult = {
	isAvailable: boolean;
	isInstalled: boolean;
	version: string | null;
	isCompatible: boolean;
	errorMessage: string | null;
	setupGuidance: string | null;
};

export class CodexProvider {
	private readonly context: ExtensionContext;
	private readonly outputChannel: OutputChannel;
	private readonly configManager: ConfigManager;

	constructor(context: ExtensionContext, outputChannel: OutputChannel) {
		this.context = context;
		this.outputChannel = outputChannel;

		this.configManager = ConfigManager.getInstance();
		this.configManager.loadSettings();
		// Listen for configuration changes
		workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration(VSC_CONFIG_NAMESPACE)) {
				this.configManager.loadSettings();
			}
		});
	}

	/**
	 * Create a temporary file with content
	 */
	private async createTempFile(
		content: string,
		prefix = "prompt"
	): Promise<string> {
		const tempDir = this.context.globalStorageUri.fsPath;
		await workspace.fs.createDirectory(this.context.globalStorageUri);

		const tempFile = join(tempDir, `${prefix}-${Date.now()}.md`);
		await promises.writeFile(tempFile, content);

		return this.convertPathIfWsl({ filePath: tempFile });
	}

	/**
	 * Convert Windows path to WSL path if needed
	 * Example: C:\Users\username\file.txt -> /mnt/c/Users/username/file.txt
	 */
	private convertPathIfWsl({ filePath }: { filePath: string }): string {
		// Check if running on Windows and path is a Windows path
		// biome-ignore lint/performance/useTopLevelRegex: ignore
		if (process.platform === "win32" && filePath.match(/^[A-Za-z]:\\/)) {
			// Replace backslashes with forward slashes
			let wslPath = filePath.replace(/\\/g, "/");
			// Convert drive letter to WSL format (C: -> /mnt/c)
			wslPath = wslPath.replace(
				// biome-ignore lint/performance/useTopLevelRegex: ignore
				/^([A-Za-z]):/,
				(_match, drive) => `/mnt/${drive.toLowerCase()}`
			);
			return wslPath;
		}

		// Return original path if not on Windows or not a Windows path
		return filePath;
	}

	/**
	 * Invokes Codex in a new terminal on the right side (split view) with the given prompt
	 * Returns the terminal instance for potential renaming
	 */
	async invokeCodexSplitView(
		prompt: string,
		title = "Kiro for Codex IDE Code"
	): Promise<Terminal> {
		try {
			// Create temp file with the prompt
			const promptFilePath = await this.createTempFile(prompt, "prompt");

			// Build the command - simple now, just codex with input redirection
			const command = `codex --permission-mode bypassPermissions < "${promptFilePath}"`;

			// Create a new terminal in the editor area (right side)
			const terminal = window.createTerminal({
				name: title,
				cwd: workspace.workspaceFolders?.[0]?.uri.fsPath,
				location: {
					viewColumn: ViewColumn.Two, // Open in the second column (right side)
				},
			});

			// Show the terminal
			terminal.show();

			// Send the command directly without echo messages
			const delay = this.configManager.getTerminalDelay();
			setTimeout(() => {
				terminal.sendText(command, true); // true = add newline to execute
			}, delay); // Configurable delay to allow venv activation

			// Clean up temp files after a delay
			setTimeout(async () => {
				try {
					await promises.unlink(promptFilePath);
					this.outputChannel.appendLine(
						`Cleaned up prompt file: ${promptFilePath}`
					);
				} catch (e) {
					// Ignore cleanup errors
					this.outputChannel.appendLine(`Failed to cleanup temp file: ${e}`);
				}
				// biome-ignore lint/style/noMagicNumbers: ignore
			}, 30_000); // 30 seconds delay to give Codex time to read the file

			// Return the terminal for potential renaming
			return terminal;
		} catch (error) {
			this.outputChannel.appendLine(`ERROR: Failed to send to Codex: ${error}`);
			window.showErrorMessage(`Failed to run Codex: ${error}`);
			throw error;
		}
	}

	/**
	 * Rename a terminal
	 */
	async renameTerminal(terminal: Terminal, newName: string): Promise<void> {
		// Make sure the terminal is active
		terminal.show();

		// Small delay to ensure terminal is focused
		// biome-ignore lint/style/noMagicNumbers: ignore
		await new Promise((resolve) => setTimeout(resolve, 100));
		this.outputChannel.appendLine(
			`[CodexProvider] ${terminal.name} Terminal renamed to: ${newName}`
		);

		// Execute the rename command
		await commands.executeCommand("workbench.action.terminal.renameWithArg", {
			name: newName,
		});
	}

	/**
	 * Execute Codex command with specific tools in background
	 * Returns a promise that resolves when the command completes
	 */
	async invokeCodexHeadless(
		prompt: string
	): Promise<{ exitCode: number | undefined; output?: string }> {
		this.outputChannel.appendLine(
			"[CodexProvider] Invoking Codex in headless mode"
		);
		this.outputChannel.appendLine("========================================");
		this.outputChannel.appendLine(prompt);
		this.outputChannel.appendLine("========================================");

		// Get the workspace folder
		const workspaceFolder = workspace.workspaceFolders?.[0];
		const cwd = workspaceFolder?.uri.fsPath;

		// Create temp file with the prompt
		const promptFilePath = await this.createTempFile(
			prompt,
			"background-prompt"
		);

		// Build command using file redirection
		const commandLine = `codex --permission-mode bypassPermissions < "${promptFilePath}"`;

		// Create hidden terminal for background execution
		const terminal = window.createTerminal({
			name: "Codex Background",
			cwd,
			hideFromUser: true,
		});

		return new Promise((resolve) => {
			let shellIntegrationChecks = 0;
			// Wait for shell integration to be available
			const checkShellIntegration = setInterval(() => {
				shellIntegrationChecks++;

				if (terminal.shellIntegration) {
					clearInterval(checkShellIntegration);

					// Execute command with shell integration
					const execution =
						terminal.shellIntegration.executeCommand(commandLine);

					// Listen for command completion
					const disposable = window.onDidEndTerminalShellExecution((event) => {
						if (event.terminal === terminal && event.execution === execution) {
							disposable.dispose();

							// Only log errors
							if (event.exitCode !== 0) {
								this.outputChannel.appendLine(
									`[Codex] Command failed with exit code: ${event.exitCode}`
								);
								this.outputChannel.appendLine(
									`[Codex] Command was: ${commandLine}`
								);
							}

							resolve({
								exitCode: event.exitCode,
								output: undefined,
							});

							// Clean up terminal and temp file after a short delay
							setTimeout(async () => {
								terminal.dispose();
								try {
									await promises.unlink(promptFilePath);
									this.outputChannel.appendLine(
										`[Codex] Cleaned up temp file: ${promptFilePath}`
									);
								} catch (e) {
									// Ignore cleanup errors
									this.outputChannel.appendLine(
										`[Codex] Failed to cleanup temp file: ${e}`
									);
								}
								// biome-ignore lint/style/noMagicNumbers: ignore
							}, 1000);
						}
					});
					// biome-ignore lint/style/noMagicNumbers: ignore
				} else if (shellIntegrationChecks > 20) {
					// After 2 seconds
					// Fallback: execute without shell integration
					clearInterval(checkShellIntegration);
					this.outputChannel.appendLine(
						"[Codex] Shell integration not available, using fallback mode"
					);
					terminal.sendText(commandLine);

					// Resolve after a reasonable delay since we can't track completion
					setTimeout(async () => {
						resolve({ exitCode: undefined });
						terminal.dispose();
						// Clean up temp file
						try {
							await promises.unlink(promptFilePath);
						} catch (e) {
							// Ignore cleanup errors
						}
						// biome-ignore lint/style/noMagicNumbers: ignore
					}, 5000);
				}
				// biome-ignore lint/style/noMagicNumbers: ignore
			}, 100);
		});
	}

	async executePlan(prompt: string): Promise<void> {
		// TODO: Implement plan execution logic
	}
}
