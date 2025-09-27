import { basename } from "path";
import {
	type Command,
	commands,
	type Event,
	EventEmitter,
	type ExtensionContext,
	FileType,
	ThemeIcon,
	type TreeDataProvider,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	window,
	workspace,
} from "vscode";
import { addDocumentToCodexChat } from "../utils/codex-chat-utils";
import { ConfigManager } from "../utils/config-manager";

const { joinPath } = Uri;

type TreeEventPayload = PromptItem | undefined | null | void;

export class PromptsExplorerProvider implements TreeDataProvider<PromptItem> {
	static readonly viewId = "kiro-codex-ide.views.promptsExplorer";
	static readonly createPromptCommandId = "kiro-codex-ide.prompts.create";
	static readonly refreshCommandId = "kiro-codex-ide.prompts.refresh";
	static readonly runPromptCommandId = "kiro-codex-ide.prompts.run";

	private readonly changeEmitter = new EventEmitter<TreeEventPayload>();
	readonly onDidChangeTreeData: Event<TreeEventPayload> =
		this.changeEmitter.event;

	private isLoading = false;

	private readonly context: ExtensionContext;
	private readonly configManager: ConfigManager;

	constructor(context: ExtensionContext) {
		this.context = context;
		this.configManager = ConfigManager.getInstance();
	}

	refresh = (): void => {
		this.isLoading = true;
		this.changeEmitter.fire();
		setTimeout(() => {
			this.isLoading = false;
			this.changeEmitter.fire();
			// biome-ignore lint/style/noMagicNumbers: ignore
		}, 120);
	};

	createPrompt = async (): Promise<void> => {
		const rootUri = this.getPromptsRoot();
		if (!rootUri) {
			await window.showWarningMessage("Open a workspace to create prompts.");
			return;
		}

		const fileName = await window.showInputBox({
			prompt: "Enter prompt file name",
			placeHolder: "sample-prompt.md",
			validateInput: (value) => {
				const trimmed = value.trim();
				if (!trimmed) {
					return "File name is required";
				}
				// biome-ignore lint/performance/useTopLevelRegex: ignore
				if (/[\\:*?"<>|]/.test(trimmed)) {
					return "Invalid characters in file name";
				}
				return;
			},
		});

		const trimmedName = fileName?.trim();
		if (!trimmedName) {
			return;
		}

		const normalizedName = trimmedName.endsWith(".md")
			? trimmedName
			: `${trimmedName}.md`;

		// biome-ignore lint/performance/useTopLevelRegex: ignore
		const parts = normalizedName.split(/[\\/]+/).filter(Boolean);
		if (parts.some((segment) => segment === "..")) {
			await window.showErrorMessage(
				"Parent directory traversal is not allowed."
			);
			return;
		}

		const parentDir =
			parts.length > 1 ? joinPath(rootUri, ...parts.slice(0, -1)) : rootUri;
		const fileUri = joinPath(rootUri, ...parts);

		try {
			await workspace.fs.createDirectory(parentDir);
			const exists = await this.pathExists(fileUri);
			if (!exists) {
				await workspace.fs.writeFile(fileUri, new Uint8Array());
			}
			await commands.executeCommand("vscode.open", fileUri);
		} catch (error) {
			await window.showErrorMessage(
				error instanceof Error
					? `Failed to create prompt: ${error.message}`
					: "Failed to create prompt."
			);
			return;
		}

		this.refresh();
	};

	runPrompt = async (item?: PromptItem): Promise<void> => {
		if (!item?.resourceUri) {
			await window.showInformationMessage("Select a prompt to run.");
			return;
		}

		try {
			await addDocumentToCodexChat(item.resourceUri);
		} catch (error) {
			const message =
				error instanceof Error
					? `Failed to run prompt: ${error.message}`
					: "Failed to run prompt.";
			await window.showErrorMessage(message);
		}
	};

	getTreeItem = (element: PromptItem): TreeItem => element;

	getChildren = async (element?: PromptItem): Promise<PromptItem[]> => {
		if (element) {
			return [];
		}

		const rootUri = this.getPromptsRoot();
		if (!rootUri) {
			return [
				new PromptItem(
					"Open a workspace to manage prompts",
					TreeItemCollapsibleState.None,
					"prompts-empty"
				),
			];
		}

		if (this.isLoading) {
			return [
				new PromptItem(
					"Loading prompts...",
					TreeItemCollapsibleState.None,
					"prompts-loading"
				),
			];
		}

		const promptFiles = await this.readMarkdownFiles(rootUri);
		if (promptFiles.length === 0) {
			const promptsPathLabel = this.configManager.getPath("prompts");
			return [
				new PromptItem(
					"No prompts found",
					TreeItemCollapsibleState.None,
					"prompts-empty",
					undefined,
					undefined,
					`Create prompts under ${promptsPathLabel}`
				),
			];
		}

		return promptFiles
			.sort((a, b) => a.localeCompare(b))
			.map((pathString) => {
				const uri = Uri.file(pathString);
				const command: Command = {
					command: "vscode.open",
					title: "Open Prompt",
					arguments: [uri],
				};
				return new PromptItem(
					basename(pathString),
					TreeItemCollapsibleState.None,
					"prompt",
					uri,
					command
				);
			});
	};

	private readonly getPromptsRoot = (): Uri | undefined => {
		try {
			const absolutePath = this.configManager.getAbsolutePath("prompts");
			return Uri.file(absolutePath);
		} catch {
			const workspaceUri = workspace.workspaceFolders?.[0]?.uri;
			const fallback = this.configManager.getPath("prompts");
			return workspaceUri ? joinPath(workspaceUri, fallback) : undefined;
		}
	};

	private readonly readMarkdownFiles = async (dir: Uri): Promise<string[]> => {
		const results: string[] = [];
		try {
			const entries = await workspace.fs.readDirectory(dir);
			for (const [name, type] of entries) {
				const entryUri = joinPath(dir, name);
				if (type === FileType.File && name.endsWith(".md")) {
					results.push(entryUri.fsPath);
					continue;
				}

				if (type === FileType.Directory) {
					const nested = await this.readMarkdownFiles(entryUri);
					results.push(...nested);
				}
			}
		} catch {
			// Directory may not exist yet
		}
		return results;
	};

	private readonly pathExists = async (target: Uri): Promise<boolean> => {
		try {
			await workspace.fs.stat(target);
			return true;
		} catch {
			return false;
		}
	};
}

class PromptItem extends TreeItem {
	readonly contextValue: string;
	// biome-ignore lint/nursery/useMaxParams: ignore
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		resourceUri?: Uri,
		command?: Command,
		tooltipOverride?: string
	) {
		super(label, collapsibleState);

		this.contextValue = contextValue;

		if (command) {
			this.command = command;
		}

		if (contextValue === "prompts-loading") {
			this.iconPath = new ThemeIcon("sync~spin");
			this.tooltip = tooltipOverride ?? "Loading prompts...";
			return;
		}

		if (contextValue === "prompts-empty") {
			this.iconPath = new ThemeIcon("info");
			this.tooltip =
				tooltipOverride ??
				"Create prompts under the configured prompts directory";
			return;
		}

		if (contextValue === "prompt") {
			this.iconPath = new ThemeIcon("file-code");
			if (resourceUri) {
				this.resourceUri = resourceUri;
				let description: string | undefined;
				try {
					description = workspace.asRelativePath(resourceUri, false);
				} catch {
					description = undefined;
				}
				this.description =
					description && description.length > 0
						? description
						: resourceUri.fsPath;
				this.tooltip = tooltipOverride ?? this.description;
			}
		}
	}
}
