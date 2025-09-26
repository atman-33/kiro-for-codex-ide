import { promises } from "fs";
import { homedir } from "os";
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
} from "vscode";
import { CONFIG_FILE_NAME, VSC_CONFIG_NAMESPACE } from "./constants";
import { SpecManager } from "./features/spec/spec-manager";
import { SteeringManager } from "./features/steering/steering-manager";
import { CodexProvider } from "./providers/codex-provider";
import { OverviewProvider } from "./providers/overview-provider";
import { PromptsExplorerProvider } from "./providers/prompts-explorer-provider";
import { SpecExplorerProvider } from "./providers/spec-explorer-provider";
import { SpecTaskCodeLensProvider } from "./providers/spec-task-code-lens-provider";
import { SteeringExplorerProvider } from "./providers/steering-explorer-provider";
import { PromptLoader } from "./services/prompt-loader";
import { ConfigManager } from "./utils/config-manager";

let codexProvider: CodexProvider;
let specManager: SpecManager;
let steeringManager: SteeringManager;
export let outputChannel: OutputChannel;

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

	// Initialize Codex provider
	codexProvider = new CodexProvider(context, outputChannel);

	// Initialize feature managers with output channel
	specManager = new SpecManager(codexProvider, outputChannel);
	steeringManager = new SteeringManager(codexProvider, outputChannel);

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

	// Initialize default settings file if not exists
	await initializeDefaultSettings();

	// Set up file watchers
	setupFileWatchers(context, specExplorer, steeringExplorer, promptsExplorer);

	// Register CodeLens provider for spec tasks
	const specTaskCodeLensProvider = new SpecTaskCodeLensProvider();

	// Use document selector for .codex spec directories
	const selector: DocumentSelector = [
		{
			language: "markdown",
			pattern: "**/.codex/specs/*/tasks.md",
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

async function initializeDefaultSettings() {
	const workspaceFolder = workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		return;
	}

	// Create .codex/settings directory if it doesn't exist (primary)
	const codexDir = Uri.joinPath(workspaceFolder.uri, ".codex");
	const codexSettingsDir = Uri.joinPath(codexDir, "settings");

	try {
		await workspace.fs.createDirectory(codexDir);
		await workspace.fs.createDirectory(codexSettingsDir);
	} catch (error) {
		// Directory might already exist
	}

	// Create kiro-codex-ide-settings.json in .codex directory
	const codexSettingsFile = Uri.joinPath(codexSettingsDir, CONFIG_FILE_NAME);

	try {
		// Check if file exists in .codex directory
		await workspace.fs.stat(codexSettingsFile);
	} catch (error) {
		// File doesn't exist, create with defaults
		const configManager = ConfigManager.getInstance();
		const defaultSettings = configManager.getSettings();

		await workspace.fs.writeFile(
			codexSettingsFile,
			Buffer.from(JSON.stringify(defaultSettings, null, 2))
		);
	}
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
		// biome-ignore lint/suspicious/useAwait: ignore
		async () => {
			outputChannel.appendLine(
				"\n=== COMMAND kiro-codex-ide.spec.create TRIGGERED ==="
			);
			outputChannel.appendLine(`Time: ${new Date().toLocaleTimeString()}`);
			// TODO: Prompt for spec name and create spec
		}
	);

	context.subscriptions.push(
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
			const name = await window.showInputBox({
				title: "Create Prompt",
				placeHolder: "prompt name (kebab-case)",
				prompt: "A markdown file will be created under .codex/prompts",
				validateInput: (v) => (v ? undefined : "Name is required"),
			});
			if (!name) {
				return;
			}
			const dir = Uri.joinPath(ws.uri, ".codex", "prompts");
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
			async (filePathOrItem?: any) => {
				try {
					let target: string | undefined;

					// 1) If called with a string path
					if (typeof filePathOrItem === "string") {
						target = filePathOrItem;
					}
					// 2) If invoked from a tree item (inline button)
					else if (filePathOrItem && typeof filePathOrItem === "object") {
						const candidate =
							(filePathOrItem.resourcePath as string | undefined) ||
							filePathOrItem.resourceUri?.fsPath;
						if (candidate) {
							target = candidate;
						}
					}
					// 3) Fallback to active editor
					if (!target) {
						const active = window.activeTextEditor?.document.uri.fsPath;
						target = active;
					}
					if (!target) {
						window.showErrorMessage("No prompt file selected");
						return;
					}
					const content = await promises.readFile(target, "utf8");
					await codexProvider.executePlan(content);
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

			const workspaceFolder = workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				window.showErrorMessage("No workspace folder found");
				return;
			}

			// Create .codex/settings directory if it doesn't exist
			const codexDir = Uri.joinPath(workspaceFolder.uri, ".codex");
			const settingsDir = Uri.joinPath(codexDir, "settings");

			try {
				await workspace.fs.createDirectory(codexDir);
				await workspace.fs.createDirectory(settingsDir);
			} catch (error) {
				// Directory might already exist
			}

			// Create or open kiro-codex-ide-settings.json
			const settingsFile = Uri.joinPath(settingsDir, CONFIG_FILE_NAME);

			try {
				// Check if file exists
				await workspace.fs.stat(settingsFile);
			} catch (error) {
				// File doesn't exist, create it with default settings
				const configManager = ConfigManager.getInstance();
				const defaultSettings = configManager.getSettings();

				await workspace.fs.writeFile(
					settingsFile,
					Buffer.from(JSON.stringify(defaultSettings, null, 2))
				);
			}

			// Open the settings file
			const document = await workspace.openTextDocument(settingsFile);
			await window.showTextDocument(document);
		}),

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

	codexWatcher.onDidCreate((uri) => debouncedRefresh("Create", uri));
	codexWatcher.onDidDelete((uri) => debouncedRefresh("Delete", uri));
	codexWatcher.onDidChange((uri) => debouncedRefresh("Change", uri));

	context.subscriptions.push(codexWatcher);

	// Watch for changes in workspace Codex settings (.codex/settings/kiro-codex-ide-settings.json)
	const wsFolder = workspace.workspaceFolders?.[0];
	if (wsFolder) {
		const settingsPattern = new RelativePattern(
			wsFolder,
			".codex/settings/kiro-codex-ide-settings.json"
		);
		const codexSettingsWatcher =
			workspace.createFileSystemWatcher(settingsPattern);

		context.subscriptions.push(codexSettingsWatcher);
	}

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
