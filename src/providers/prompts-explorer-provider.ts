import { basename } from "path";
import { homedir } from "os";
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

type PromptSource = "project" | "global";

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

	getChildren = (element?: PromptItem): Promise<PromptItem[]> => {
		if (!element) {
			return Promise.resolve(this.getRootItems());
		}

		if (element.contextValue === "prompt-group-project") {
			return this.getPromptGroupChildren("project");
		}

		if (element.contextValue === "prompt-group-global") {
			return this.getPromptGroupChildren("global");
		}

		return Promise.resolve([]);
	};

	private readonly getRootItems = (): PromptItem[] => {
		const projectDescription = this.configManager.getPath("prompts");
		const globalDescription = this.getGlobalPromptsLabel();

		return [
			new PromptItem(
				"Project",
				TreeItemCollapsibleState.Collapsed,
				"prompt-group-project",
				{
					description: projectDescription,
					tooltip: `Project prompts located at ${projectDescription}`,
					source: "project",
				}
			),
			new PromptItem(
				"Global",
				TreeItemCollapsibleState.Collapsed,
				"prompt-group-global",
				{
					description: globalDescription,
					tooltip: `Global prompts located at ${globalDescription}`,
					source: "global",
				}
			),
		];
	};

	private readonly getPromptGroupChildren = (
		source: PromptSource
	): Promise<PromptItem[]> => {
		if (this.isLoading) {
			return Promise.resolve([this.createLoadingItem()]);
		}

		if (source === "project") {
			return this.getProjectPromptItems();
		}

		return this.getGlobalPromptItems();
	};

	private readonly getProjectPromptItems = (): Promise<PromptItem[]> => {
		const rootUri = this.getPromptsRoot();
		if (!rootUri) {
			return Promise.resolve([
				new PromptItem(
					"Open a workspace to manage prompts",
					TreeItemCollapsibleState.None,
					"prompts-empty"
				),
			]);
		}

		return this.createPromptItems(rootUri, "project");
	};

	private readonly getGlobalPromptItems = (): Promise<PromptItem[]> => {
		const rootUri = this.getGlobalPromptsRoot();
		if (!rootUri) {
			return Promise.resolve([
				new PromptItem(
					"Global prompts directory not found",
					TreeItemCollapsibleState.None,
					"prompts-empty"
				),
			]);
		}

		return this.createPromptItems(rootUri, "global");
	};

	private readonly createPromptItems = async (
		rootUri: Uri,
		source: PromptSource
	): Promise<PromptItem[]> => {
		const promptFiles = await this.readMarkdownFiles(rootUri);

		if (promptFiles.length === 0) {
			const label =
				source === "project"
					? this.configManager.getPath("prompts")
					: this.getGlobalPromptsLabel();
			return [
				new PromptItem(
					"No prompts found",
					TreeItemCollapsibleState.None,
					"prompts-empty",
					{
						tooltip: `Add prompts under ${label}`,
					}
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
					{
						resourceUri: uri,
						command,
						source,
					}
				);
			});
	};

	private readonly createLoadingItem = (): PromptItem =>
		new PromptItem(
			"Loading prompts...",
			TreeItemCollapsibleState.None,
			"prompts-loading"
		);

	private readonly getGlobalPromptsRoot = (): Uri | undefined => {
		try {
			const homeUri = Uri.file(homedir());
			return joinPath(homeUri, ".codex", "prompts");
		} catch {
			return;
		}
	};

	private readonly getGlobalPromptsLabel = (): string => {
		const home = homedir();
		if (!home) {
			return ".codex/prompts";
		}

		if (process.platform === "win32") {
			return `${home}\\.codex\\prompts`;
		}

		return `${home}/.codex/prompts`;
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

type PromptItemOptions = {
	resourceUri?: Uri;
	command?: Command;
	tooltip?: string;
	description?: string;
	source?: PromptSource;
};

class PromptItem extends TreeItem {
	readonly contextValue: string;
	readonly source: PromptSource | undefined;

	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		options?: PromptItemOptions
	) {
		super(label, collapsibleState);

		this.contextValue = contextValue;
		this.source = options?.source;

		if (options?.command) {
			this.command = options.command;
		}

		const handler = PromptItem.contextHandlers[contextValue];
		if (handler) {
			handler(this, options);
		} else if (options?.tooltip) {
			this.tooltip = options.tooltip;
		}
	}

	private static readonly applyFolderContext = (
		item: PromptItem,
		options?: PromptItemOptions
	): void => {
		item.iconPath = new ThemeIcon("folder");
		item.tooltip = options?.tooltip;
		item.description = options?.description;
	};

	private static readonly formatResourceDescription = (uri: Uri): string => {
		const relativePath = PromptItem.tryGetRelativePath(uri);
		if (relativePath && relativePath.length > 0) {
			return relativePath;
		}

		return uri.fsPath;
	};

	private static readonly tryGetRelativePath = (
		uri: Uri
	): string | undefined => {
		try {
			return workspace.asRelativePath(uri, false);
		} catch {
			return;
		}
	};

	private static readonly contextHandlers: Record<
		string,
		(item: PromptItem, options?: PromptItemOptions) => void
	> = {
		"prompts-loading": (item, options) => {
			item.iconPath = new ThemeIcon("sync~spin");
			item.tooltip = options?.tooltip ?? "Loading prompts...";
		},
		"prompts-empty": (item, options) => {
			item.iconPath = new ThemeIcon("info");
			item.tooltip =
				options?.tooltip ??
				"Create prompts under the configured prompts directory";
		},
		prompt: (item, options) => {
			item.iconPath = new ThemeIcon("file-code");
			if (!options) {
				return;
			}

			if (!options.resourceUri) {
				if (options.tooltip) {
					item.tooltip = options.tooltip;
				}
				if (options.description) {
					item.description = options.description;
				}
				return;
			}

			item.resourceUri = options.resourceUri;
			const description =
				options.description ??
				PromptItem.formatResourceDescription(options.resourceUri);
			item.description = description;
			item.tooltip = options.tooltip ?? description;
		},
		"prompt-group-project": PromptItem.applyFolderContext,
		"prompt-group-global": PromptItem.applyFolderContext,
	};
}
