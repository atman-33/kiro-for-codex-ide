import {
	type Command,
	type Event,
	type ExtensionContext,
	type TreeDataProvider,
	EventEmitter,
	ThemeIcon,
	TreeItem,
	TreeItemCollapsibleState,
	workspace,
} from "vscode";
import type { SpecManager } from "../features/spec/spec-manager";

export class SpecExplorerProvider implements TreeDataProvider<SpecItem> {
	static readonly viewId = "kiro-codex-ide.views.specExplorer";
	static readonly navigateRequirementsCommandId =
		"kiro-codex-ide.spec.navigate.requirements";
	static readonly navigateDesignCommandId =
		"kiro-codex-ide.spec.navigate.design";
	static readonly navigateTasksCommandId = "kiro-codex-ide.spec.navigate.tasks";
	private readonly _onDidChangeTreeData: EventEmitter<
		SpecItem | undefined | null | void
	> = new EventEmitter<SpecItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<SpecItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private specManager!: SpecManager;
	private readonly context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this.context = context;
	}

	setSpecManager(specManager: SpecManager) {
		this.specManager = specManager;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: SpecItem): TreeItem {
		return element;
	}

	async getChildren(element?: SpecItem): Promise<SpecItem[]> {
		if (!(workspace.workspaceFolders && this.specManager)) {
			return [];
		}

		if (!element) {
			// Root level - show all specs
			const specs = await this.specManager.getSpecList();
			const specItems = specs.map(
				(specName) =>
					new SpecItem(
						specName,
						TreeItemCollapsibleState.Expanded,
						"spec",
						this.context,
						specName
					)
			);

			return specItems;
		}
		if (element.contextValue === "spec") {
			// Show spec documents
			const specsPath = await this.specManager.getSpecBasePath();
			const specPath = `${specsPath}/${element.specName}`;

			return [
				new SpecItem(
					"requirements",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName!,
					"requirements",
					{
						command: SpecExplorerProvider.navigateRequirementsCommandId,
						title: "Open Requirements",
						arguments: [element.specName],
					},
					`${specPath}/requirements.md`
				),
				new SpecItem(
					"design",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName!,
					"design",
					{
						command: SpecExplorerProvider.navigateDesignCommandId,
						title: "Open Design",
						arguments: [element.specName],
					},
					`${specPath}/design.md`
				),
				new SpecItem(
					"tasks",
					TreeItemCollapsibleState.None,
					"spec-document",
					this.context,
					element.specName!,
					"tasks",
					{
						command: SpecExplorerProvider.navigateTasksCommandId,
						title: "Open Tasks",
						arguments: [element.specName],
					},
					`${specPath}/tasks.md`
				),
			];
		}

		return [];
	}
}

class SpecItem extends TreeItem {
	readonly label: string;
	readonly collapsibleState: TreeItemCollapsibleState;
	readonly contextValue: string;
	private readonly context: ExtensionContext;
	readonly specName?: string;
	readonly documentType?: string;
	readonly command?: Command;
	private readonly filePath?: string;

	// biome-ignore lint/nursery/useMaxParams: ignore
	constructor(
		label: string,
		collapsibleState: TreeItemCollapsibleState,
		contextValue: string,
		context: ExtensionContext,
		specName?: string,
		documentType?: string,
		command?: Command,
		filePath?: string
	) {
		super(label, collapsibleState);
		this.label = label;
		this.collapsibleState = collapsibleState;
		this.contextValue = contextValue;
		this.context = context;
		this.specName = specName;
		this.documentType = documentType;
		this.command = command;
		this.filePath = filePath;

		if (contextValue === "spec") {
			this.iconPath = new ThemeIcon("package");
			this.tooltip = `Spec: ${label}`;
		} else if (contextValue === "spec-document") {
			// Different icons for different document types
			if (documentType === "requirements") {
				this.iconPath = new ThemeIcon("chip");
				this.tooltip = `Requirements: ${specName}/${label}`;
			} else if (documentType === "design") {
				this.iconPath = new ThemeIcon("layers");
				this.tooltip = `Design: ${specName}/${label}`;
			} else if (documentType === "tasks") {
				this.iconPath = new ThemeIcon("tasklist");
				this.tooltip = `Tasks: ${specName}/${label}`;
			} else {
				this.iconPath = new ThemeIcon("file");
				this.tooltip = `${documentType}: ${specName}/${label}`;
			}

			// Set description to file path
			if (filePath) {
				this.description = filePath;
			}

			// Add context menu items
			if (
				documentType === "requirements" ||
				documentType === "design" ||
				documentType === "tasks"
			) {
				this.contextValue = `spec-document-${documentType}`;
			}
		}
	}
}
