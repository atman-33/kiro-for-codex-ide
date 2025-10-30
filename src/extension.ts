import { homedir } from "os";
import { join } from "node:path";
import type { FileSystemWatcher } from "vscode";
import {
	commands,
	ConfigurationTarget,
	type DocumentSelector,
	env,
	type ExtensionContext,
	languages,
	type OutputChannel,
	Range,
	RelativePattern,
	Uri,
	window,
	workspace,
	WorkspaceEdit,
	type WorkspaceFolder,
} from "vscode";
import { VSC_CONFIG_NAMESPACE } from "./constants";
import { SpecManager } from "./features/spec/spec-manager";
import { SteeringManager } from "./features/steering/steering-manager";
import { CodexProvider } from "./providers/codex-provider";
import { OverviewProvider } from "./providers/overview-provider";
import { PromptsExplorerProvider } from "./providers/prompts-explorer-provider";
import { SpecExplorerProvider } from "./providers/spec-explorer-provider";
import { SpecTaskCodeLensProvider } from "./providers/spec-task-code-lens-provider";
import { SteeringExplorerProvider } from "./providers/steering-explorer-provider";
import { PromptLoader } from "./services/prompt-loader";
import { addDocumentToCodexChat } from "./utils/codex-chat-utils";
import { ConfigManager } from "./utils/config-manager";

let codexProvider: CodexProvider;
let specManager: SpecManager;
let steeringManager: SteeringManager;
export let outputChannel: OutputChannel;

const ensureWorkspaceCodexGitignore = async (folder: WorkspaceFolder) => {
	const codexDir = Uri.joinPath(folder.uri, ".codex");
	const gitignoreUri = Uri.joinPath(codexDir, ".gitignore");

	try {
		await workspace.fs.stat(gitignoreUri);
		return;
	} catch {
		// File missing, continue to create it.
	}

	try {
		await workspace.fs.createDirectory(codexDir);
	} catch {
		// Directory already exists or cannot be created; ignore and attempt to write the file.
	}

	try {
		await workspace.fs.writeFile(gitignoreUri, Buffer.from("tmp/\n"));
	} catch (error) {
		outputChannel?.appendLine(
			`Failed to create ${gitignoreUri.fsPath}: ${error}`
		);
	}
};

export async function activate(context: ExtensionContext) {
	// Create output channel for debugging
	outputChannel = window.createOutputChannel("Kiro for Codex - Debug");

	// Initialize PromptLoader
	try {
		const promptLoader = PromptLoader.getInstance();
		promptLoader.initialize();
		outputChannel.appendLine("PromptLoader initialized successfully");
	} catch (error) {
		outputChannel.appendLine(`Failed to initialize PromptLoader: ${error}`);
		window.showErrorMessage(`Failed to initialize prompt system: ${error}`);
	}

	// Check workspace status
	const workspaceFolders = workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		outputChannel.appendLine("WARNING: No workspace folder found!");
	}

	if (workspaceFolders && workspaceFolders.length > 0) {
		await Promise.all(workspaceFolders.map(ensureWorkspaceCodexGitignore));
	}

	// Initialize Codex provider
	codexProvider = new CodexProvider(context, outputChannel);

	const configManager = ConfigManager.getInstance();
	await configManager.loadSettings();

	// Initialize feature managers with output channel
	specManager = new SpecManager(context, outputChannel);
	steeringManager = new SteeringManager(context, codexProvider, outputChannel);

	// Register tree data providers
	const overviewProvider = new OverviewProvider(context);
	const specExplorer = new SpecExplorerProvider(context);
	const steeringExplorer = new SteeringExplorerProvider(context);
	const promptsExplorer = new PromptsExplorerProvider(context);

	// Set managers
	specExplorer.setSpecManager(specManager);
	steeringExplorer.setSteeringManager(steeringManager);

	context.subscriptions.push(
		window.registerTreeDataProvider(
			"kiro-codex-ide.views.overview",
			overviewProvider
		),
		window.registerTreeDataProvider(
			"kiro-codex-ide.views.specExplorer",
			specExplorer
		),
		window.registerTreeDataProvider(
			"kiro-codex-ide.views.steeringExplorer",
			steeringExplorer
		)
	);
	context.subscriptions.push(
		window.registerTreeDataProvider(
			"kiro-codex-ide.views.promptsExplorer",
			promptsExplorer
		)
	);

	// Register commands
	registerCommands(context, specExplorer, steeringExplorer, promptsExplorer);

	// Set up file watchers
	setupFileWatchers(context, specExplorer, steeringExplorer, promptsExplorer);

	// Register CodeLens provider for spec tasks
	const specTaskCodeLensProvider = new SpecTaskCodeLensProvider();

	// Use document selector for spec task files (dynamic paths handled inside provider)
	const selector: DocumentSelector = [
		{
			language: "markdown",
			pattern: "**/*tasks.md",
			scheme: "file",
		},
	];

	const disposable = languages.registerCodeLensProvider(
		selector,
		specTaskCodeLensProvider
	);

	context.subscriptions.push(disposable);

	outputChannel.appendLine("CodeLens provider for spec tasks registered");
}

async function toggleViews() {
	const config = workspace.getConfiguration(VSC_CONFIG_NAMESPACE);
	const currentVisibility = {
		specs: config.get("views.specs.visible", true),
		hooks: config.get("views.hooks.visible", false),
		steering: config.get("views.steering.visible", true),
		mcp: config.get("views.mcp.visible", false),
	};

	const items: Array<{ label: string; picked: boolean; id: string }> = [
		{
			label: `$(${currentVisibility.specs ? "check" : "blank"}) Specs`,
			picked: currentVisibility.specs,
			id: "specs",
		},

		{
			label: `$(${currentVisibility.steering ? "check" : "blank"}) Agent Steering`,
			picked: currentVisibility.steering,
			id: "steering",
		},
	];
	const selected = await window.showQuickPick(items, {
		canPickMany: true,
		placeHolder: "Select views to show",
	});

	if (selected) {
		const newVisibility = {
			specs: selected.some((item) => item.id === "specs"),
			hooks: selected.some((item) => item.id === "hooks"),
			steering: selected.some((item) => item.id === "steering"),
			mcp: selected.some((item) => item.id === "mcp"),
		};

		await config.update(
			"views.specs.visible",
			newVisibility.specs,
			ConfigurationTarget.Workspace
		);
		await config.update(
			"views.steering.visible",
			newVisibility.steering,
			ConfigurationTarget.Workspace
		);

		window.showInformationMessage("View visibility updated!");
	}
}

function registerCommands(
	context: ExtensionContext,
	specExplorer: SpecExplorerProvider,
	steeringExplorer: SteeringExplorerProvider,
	promptsExplorer: PromptsExplorerProvider
) {
	const createSpecCommand = commands.registerCommand(
		"kiro-codex-ide.spec.create",
		async () => {
			outputChannel.appendLine(
				`[Spec] create command triggered at ${new Date().toISOString()}`
			);

			try {
				await specManager.create();
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				outputChannel.appendLine(`[Spec] create command failed: ${message}`);
				window.showErrorMessage(`Failed to create spec prompt: ${message}`);
			}
		}
	);

	context.subscriptions.push(
		createSpecCommand,
		commands.registerCommand(
			"kiro-codex-ide.spec.navigate.requirements",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "requirements");
			}
		),

		commands.registerCommand(
			"kiro-codex-ide.spec.navigate.design",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "design");
			}
		),

		commands.registerCommand(
			"kiro-codex-ide.spec.navigate.tasks",
			async (specName: string) => {
				await specManager.navigateToDocument(specName, "tasks");
			}
		),

		commands.registerCommand(
			"kiro-codex-ide.spec.implTask",
			async (documentUri: Uri, lineNumber: number, taskDescription: string) => {
				outputChannel.appendLine(
					`[Task Execute] Line ${lineNumber + 1}: ${taskDescription}`
				);

				// Update task status to completed
				const document = await workspace.openTextDocument(documentUri);
				const edit = new WorkspaceEdit();
				const line = document.lineAt(lineNumber);
				const newLine = line.text.replace("- [ ]", "- [x]");
				const range = new Range(lineNumber, 0, lineNumber, line.text.length);
				edit.replace(documentUri, range, newLine);
				await workspace.applyEdit(edit);

				// Use Codex CLI to execute task
				await specManager.implTask(documentUri.fsPath, taskDescription);
			}
		),
		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("kiro-codex-ide.spec.refresh", async () => {
			outputChannel.appendLine("[Manual Refresh] Refreshing spec explorer...");
			specExplorer.refresh();
		})
	);

	// No UI mode toggle commands required

	// Steering commands
	context.subscriptions.push(
		commands.registerCommand("kiro-codex-ide.steering.create", async () => {
			await steeringManager.createCustom();
		}),

		commands.registerCommand(
			"kiro-codex-ide.steering.generateInitial",
			async () => {
				await steeringManager.init();
			}
		),

		commands.registerCommand(
			"kiro-codex-ide.steering.refine",
			async (item: any) => {
				// Item is always from tree view
				const uri = Uri.file(item.resourcePath);
				await steeringManager.refine(uri);
			}
		),

		commands.registerCommand(
			"kiro-codex-ide.steering.delete",
			async (item: any) => {
				outputChannel.appendLine(`[Steering] Deleting: ${item.label}`);

				// Use SteeringManager to delete the document
				const result = await steeringManager.delete(
					item.label,
					item.resourcePath
				);

				if (!result.success && result.error) {
					window.showErrorMessage(result.error);
				}
			}
		),

		// Configuration commands
		commands.registerCommand(
			"kiro-codex-ide.steering.createUserRule",
			async () => {
				await steeringManager.createUserConfiguration();
			}
		),

		commands.registerCommand(
			"kiro-codex-ide.steering.createProjectRule",
			async () => {
				await steeringManager.createProjectDocumentation();
			}
		),

		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("kiro-codex-ide.steering.refresh", async () => {
			outputChannel.appendLine(
				"[Manual Refresh] Refreshing steering explorer..."
			);
			steeringExplorer.refresh();
		})
	);

	// Add file save confirmation for agent files
	context.subscriptions.push(
		workspace.onWillSaveTextDocument(async (event) => {
			const document = event.document;
			const filePath = document.fileName;

			// Check if this is an agent file in .codex directories
			if (filePath.includes(".codex/agents/") && filePath.endsWith(".md")) {
				// Show confirmation dialog
				const result = await window.showWarningMessage(
					"Are you sure you want to save changes to this agent file?",
					{ modal: true },
					"Save",
					"Cancel"
				);

				if (result !== "Save") {
					// Cancel the save operation by waiting forever
					// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
					event.waitUntil(new Promise(() => {}));
				}
			}
		})
	);

	// Spec delete command
	context.subscriptions.push(
		commands.registerCommand(
			"kiro-codex-ide.spec.delete",
			async (item: any) => {
				await specManager.delete(item.label);
			}
		)
	);

	// Codex integration commands
	// Codex CLI integration commands

	// Prompts commands
	context.subscriptions.push(
		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("kiro-codex-ide.prompts.refresh", async () => {
			outputChannel.appendLine(
				"[Manual Refresh] Refreshing prompts explorer..."
			);
			promptsExplorer.refresh();
		}),
		commands.registerCommand("kiro-codex-ide.prompts.create", async () => {
			const ws = workspace.workspaceFolders?.[0];
			if (!ws) {
				window.showErrorMessage("No workspace folder found");
				return;
			}
			const configManager = ConfigManager.getInstance();
			const promptsPathLabel = configManager.getPath("prompts");
			const name = await window.showInputBox({
				title: "Create Prompt",
				placeHolder: "prompt name (kebab-case)",
				prompt: `A markdown file will be created under ${promptsPathLabel}`,
				validateInput: (v) => (v ? undefined : "Name is required"),
			});
			if (!name) {
				return;
			}
			let dir = Uri.joinPath(ws.uri, ".codex", "prompts");
			try {
				dir = Uri.file(configManager.getAbsolutePath("prompts"));
			} catch {
				// fall back to default under workspace
			}
			const file = Uri.joinPath(dir, `${name}.md`);
			try {
				await workspace.fs.createDirectory(dir);
				const content = Buffer.from(
					`# ${name}\n\nDescribe your prompt here. This file will be sent to Codex when executed.\n`
				);
				await workspace.fs.writeFile(file, content);
				const doc = await workspace.openTextDocument(file);
				await window.showTextDocument(doc);
				promptsExplorer.refresh();
			} catch (e) {
				window.showErrorMessage(`Failed to create prompt: ${e}`);
			}
		}),
		commands.registerCommand(
			"kiro-codex-ide.prompts.run",
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
			async (filePathOrItem?: any) => {
				try {
					let targetUri: Uri | undefined;

					if (typeof filePathOrItem === "string") {
						targetUri = Uri.file(filePathOrItem);
					} else if (filePathOrItem && typeof filePathOrItem === "object") {
						const candidateUri: Uri | undefined =
							filePathOrItem.resourceUri ??
							(typeof filePathOrItem.resourcePath === "string"
								? Uri.file(filePathOrItem.resourcePath)
								: undefined);

						if (candidateUri) {
							targetUri = candidateUri;
						}
					}

					if (!targetUri) {
						targetUri = window.activeTextEditor?.document.uri;
					}

					if (!targetUri) {
						window.showErrorMessage("No prompt file selected");
						return;
					}

					await addDocumentToCodexChat(targetUri);
				} catch (e) {
					window.showErrorMessage(`Failed to run prompt: ${e}`);
				}
			}
		)
	);

	// Update checker command

	// Group the following commands in a single subscriptions push
	context.subscriptions.push(
		// Overview and settings commands
		commands.registerCommand("kiro-codex-ide.settings.open", async () => {
			outputChannel.appendLine("Opening Kiro settings...");
			await commands.executeCommand(
				"workbench.action.openSettings",
				VSC_CONFIG_NAMESPACE
			);
		}),
		commands.registerCommand(
			"kiro-codex-ide.settings.openGlobalConfig",
			async () => {
				outputChannel.appendLine("Opening global Codex config...");
				const userHome =
					homedir() || process.env.HOME || process.env.USERPROFILE;

				if (!userHome) {
					window.showErrorMessage(
						"Unable to resolve the user home directory for Codex config."
					);
					return;
				}

				const configUri = Uri.file(join(userHome, ".codex", "config.toml"));

				try {
					await workspace.fs.stat(configUri);
				} catch {
					window.showWarningMessage(
						`Global Codex config not found at ${configUri.fsPath}. Create the file manually to customize Codex CLI.`
					);
					return;
				}

				try {
					const document = await workspace.openTextDocument(configUri);
					await window.showTextDocument(document, { preview: false });
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					window.showErrorMessage(
						`Failed to open global Codex config: ${message}`
					);
				}
			}
		),

		// biome-ignore lint/suspicious/useAwait: ignore
		commands.registerCommand("kiro-codex-ide.help.open", async () => {
			outputChannel.appendLine("Opening Kiro help...");
			const helpUrl = "https://github.com/atman-33/kiro-for-codex-ide#readme";
			env.openExternal(Uri.parse(helpUrl));
		}),

		commands.registerCommand("kiro-codex-ide.menu.open", async () => {
			outputChannel.appendLine("Opening Kiro menu...");
			await toggleViews();
		})
	);
}

function setupFileWatchers(
	context: ExtensionContext,
	specExplorer: SpecExplorerProvider,
	steeringExplorer: SteeringExplorerProvider,
	promptsExplorer: PromptsExplorerProvider
) {
	// Watch for changes in .codex directories with debouncing
	const codexWatcher = workspace.createFileSystemWatcher("**/.codex/**/*");

	let refreshTimeout: NodeJS.Timeout | undefined;
	const debouncedRefresh = (event: string, uri: Uri) => {
		outputChannel.appendLine(`[FileWatcher] ${event}: ${uri.fsPath}`);

		if (refreshTimeout) {
			clearTimeout(refreshTimeout);
		}
		refreshTimeout = setTimeout(() => {
			specExplorer.refresh();
			steeringExplorer.refresh();
			promptsExplorer.refresh();
			// biome-ignore lint/style/noMagicNumbers: ignore
		}, 1000); // Increase debounce time to 1 second
	};

	const attachWatcherHandlers = (watcher: FileSystemWatcher) => {
		watcher.onDidCreate((uri) => debouncedRefresh("Create", uri));
		watcher.onDidDelete((uri) => debouncedRefresh("Delete", uri));
		watcher.onDidChange((uri) => debouncedRefresh("Change", uri));
	};

	attachWatcherHandlers(codexWatcher);

	const watchers: FileSystemWatcher[] = [codexWatcher];

	const wsFolder = workspace.workspaceFolders?.[0];
	if (wsFolder) {
		const normalizeRelativePath = (value: string) =>
			value
				.replace(/\\/g, "/")
				// biome-ignore lint/performance/useTopLevelRegex: ignore
				.replace(/^\.\//, "")
				// biome-ignore lint/performance/useTopLevelRegex: ignore
				.replace(/\/+$/, "");

		const configManager = ConfigManager.getInstance();
		const configuredPaths = [
			configManager.getPath("prompts"),
			configManager.getPath("specs"),
			configManager.getPath("steering"),
		];

		const extraPatterns = new Set<string>();
		for (const rawPath of configuredPaths) {
			const normalized = normalizeRelativePath(rawPath);
			if (!normalized || normalized.startsWith("..")) {
				continue;
			}
			if (normalized === ".codex" || normalized.startsWith(".codex/")) {
				continue;
			}
			extraPatterns.add(`${normalized}/**/*`);
		}

		for (const pattern of extraPatterns) {
			const watcher = workspace.createFileSystemWatcher(
				new RelativePattern(wsFolder, pattern)
			);
			attachWatcherHandlers(watcher);
			watchers.push(watcher);
		}
	}

	context.subscriptions.push(...watchers);

	// Watch for changes in CODEX.md files
	const globalHome = homedir() || process.env.USERPROFILE || "";
	const globalCodexMdWatcher = workspace.createFileSystemWatcher(
		new RelativePattern(globalHome, ".codex/CODEX.md")
	);
	const projectCodexMdWatcher =
		workspace.createFileSystemWatcher("**/CODEX.md");

	globalCodexMdWatcher.onDidCreate(() => steeringExplorer.refresh());
	globalCodexMdWatcher.onDidDelete(() => steeringExplorer.refresh());
	projectCodexMdWatcher.onDidCreate(() => steeringExplorer.refresh());
	projectCodexMdWatcher.onDidDelete(() => steeringExplorer.refresh());

	context.subscriptions.push(globalCodexMdWatcher, projectCodexMdWatcher);
}

// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
export function deactivate() {}
