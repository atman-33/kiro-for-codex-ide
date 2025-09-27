import { existsSync } from "fs";
import { join, relative } from "path";
import {
	type Command,
	type Event,
	type ExtensionContext,
	type TreeDataProvider,
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	Uri,
	workspace,
} from "vscode";
import type { SteeringManager } from "../features/steering/steering-manager";

import { homedir } from "os";

export class SteeringExplorerProvider
	implements TreeDataProvider<SteeringItem>
{
	static readonly viewId = "kiro-codex-ide.views.steeringExplorer";
	static readonly createUserRuleCommandId =
		"kiro-codex-ide.steering.createUserRule";
	static readonly createProjectRuleCommandId =
		"kiro-codex-ide.steering.createProjectRule";
	private readonly _onDidChangeTreeData: EventEmitter<
		SteeringItem | undefined | null | void
	> = new EventEmitter<SteeringItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<SteeringItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private steeringManager!: SteeringManager;
	private readonly context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this.context = context;
	}

	setSteeringManager(steeringManager: SteeringManager) {
		this.steeringManager = steeringManager;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SteeringItem): TreeItem {
		return element;
	}

	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ignore
	async getChildren(element?: SteeringItem): Promise<SteeringItem[]> {
		if (!element) {
			// Root level - show AGENTS.md files directly
			const items: SteeringItem[] = [];

			// Check existence of files
			const homeDir =
				homedir() || process.env.USERPROFILE || process.env.HOME || "";
			const globalCodexMd = join(homeDir, ".codex", "AGENTS.md");
			const globalExists = existsSync(globalCodexMd);

			let projectCodexMd = "";
			let projectExists = false;
			if (workspace.workspaceFolders) {
				projectCodexMd = join(
					workspace.workspaceFolders[0].uri.fsPath,
					"AGENTS.md"
				);
				projectExists = existsSync(projectCodexMd);
			}

			// Always show Global Rule and Project Rule (if they exist)
			if (globalExists) {
				items.push(
					new SteeringItem(
						"Global Rule",
						TreeItemCollapsibleState.None,
						"codex-md-global",
						globalCodexMd,
						this.context,
						{
							command: "vscode.open",
							title: "Open Global AGENTS.md",
							arguments: [Uri.file(globalCodexMd)],
						}
					)
				);
			}

			if (projectExists) {
				items.push(
					new SteeringItem(
						"Project Rule",
						TreeItemCollapsibleState.None,
						"codex-md-project",
						projectCodexMd,
						this.context,
						{
							command: "vscode.open",
							title: "Open Project AGENTS.md",
							arguments: [Uri.file(projectCodexMd)],
						}
					)
				);
			}

			// Traditional steering documents - add them directly at root level if they exist
			if (workspace.workspaceFolders && this.steeringManager) {
				const steeringDocs = await this.steeringManager.getSteeringDocuments();
				if (steeringDocs.length > 0) {
					// Add a collapsible header item for steering documents
					items.push(
						new SteeringItem(
							"Steering Docs",
							TreeItemCollapsibleState.Expanded, // Make it expandable
							"steering-header",
							"",
							this.context
						)
					);
				}
			}

			// Add create buttons at the bottom for missing files
			if (!globalExists) {
				items.push(
					new SteeringItem(
						"Create Global Rule",
						TreeItemCollapsibleState.None,
						"create-global-codex",
						"",
						this.context,
						{
							command: SteeringExplorerProvider.createUserRuleCommandId,
							title: "Create Global AGENTS.md",
						}
					)
				);
			}

			if (workspace.workspaceFolders && !projectExists) {
				items.push(
					new SteeringItem(
						"Create Project Rule",
						TreeItemCollapsibleState.None,
						"create-project-codex",
						"",
						this.context,
						{
							command: SteeringExplorerProvider.createProjectRuleCommandId,
							title: "Create Project AGENTS.md",
						}
					)
				);
			}

			return items;
		}
		if (element.contextValue === "steering-header") {
			// Return steering documents as children of the header
			const items: SteeringItem[] = [];

			if (workspace.workspaceFolders && this.steeringManager) {
				const steeringDocs = await this.steeringManager.getSteeringDocuments();
				const workspacePath = workspace.workspaceFolders[0].uri.fsPath;

				for (const doc of steeringDocs) {
					// Calculate relative path from workspace root
					const relativePath = relative(workspacePath, doc.path);
					items.push(
						new SteeringItem(
							doc.name,
							TreeItemCollapsibleState.None,
							"steering-document",
							doc.path,
							this.context,
							{
								command: "vscode.open",
								title: "Open Steering Document",
								arguments: [Uri.file(doc.path)],
							},
							relativePath // Pass relative path without prefix
						)
					);
				}
			}

			return items;
		}

		return [];
	}
}

class SteeringItem extends TreeItem {
	readonly label: string;
	readonly collapsibleState: TreeItemCollapsibleState;
	readonly contextValue: string;
	readonly resourcePath: string;
	private readonly context: ExtensionContext;
	readonly command?: Command;
	private readonly filename?: string;
	// biome-ignore lint/nursery/useMaxParams: ignore
	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		resourcePath: string,
		context: ExtensionContext,
		command?: Command,
		filename?: string
	) {
		super(label, collapsibleState);
		this.label = label;
		this.collapsibleState = collapsibleState;
		this.contextValue = contextValue;
		this.resourcePath = resourcePath;
		this.context = context;
		this.command = command;
		this.filename = filename;

		// Set appropriate icons based on type
		if (contextValue === "codex-md-global") {
			this.iconPath = new ThemeIcon("globe");
			this.tooltip = `Global AGENTS.md: ${resourcePath}`;
			this.description = "~/.codex/AGENTS.md";
		} else if (contextValue === "codex-md-project") {
			this.iconPath = new ThemeIcon("root-folder");
			this.tooltip = `Project AGENTS.md: ${resourcePath}`;
			this.description = "AGENTS.md";
		} else if (contextValue === "create-global-codex") {
			this.iconPath = new ThemeIcon("globe");
			this.tooltip = "Click to create Global AGENTS.md";
		} else if (contextValue === "create-project-codex") {
			this.iconPath = new ThemeIcon("root-folder");
			this.tooltip = "Click to create Project AGENTS.md";
		} else if (contextValue === "separator") {
			this.iconPath = undefined;
			this.description = undefined;
		} else if (contextValue === "steering-header") {
			this.iconPath = new ThemeIcon("folder-library");
			this.description = undefined;
			// Make it visually distinct but not clickable
			this.tooltip = "Generated project steering documents";
		} else if (contextValue === "steering-document") {
			// Different icons for different steering documents
			if (label === "product") {
				this.iconPath = new ThemeIcon("lightbulb-empty");
			} else if (label === "tech") {
				this.iconPath = new ThemeIcon("circuit-board");
			} else if (label === "structure") {
				this.iconPath = new ThemeIcon("list-tree");
			} else {
				this.iconPath = new ThemeIcon("file");
			}
			this.tooltip = `Steering document: ${resourcePath}`;
			this.description = filename; // Show the relative path
		}
	}
}
