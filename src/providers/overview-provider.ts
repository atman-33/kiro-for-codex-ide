import {
	EventEmitter,
	TreeItem,
	type Event,
	type ExtensionContext,
	type TreeDataProvider,
	type TreeItemCollapsibleState,
} from "vscode";

export class OverviewProvider implements TreeDataProvider<OverviewItem> {
	private readonly _onDidChangeTreeData: EventEmitter<
		OverviewItem | undefined | null | void
	> = new EventEmitter<OverviewItem | undefined | null | void>();
	readonly onDidChangeTreeData: Event<OverviewItem | undefined | null | void> =
		this._onDidChangeTreeData.event;
	private readonly context: ExtensionContext;

	constructor(context: ExtensionContext) {
		this.context = context;
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: OverviewItem): TreeItem {
		return element;
	}

	// biome-ignore lint/suspicious/useAwait: ignore
	async getChildren(element?: OverviewItem): Promise<OverviewItem[]> {
		if (!element) {
			// Return empty array to show viewsWelcome content
			return [];
		}
		return [];
	}
}

class OverviewItem extends TreeItem {
	// biome-ignore lint/complexity/noUselessConstructor: ignore
	constructor(label: string, collapsibleState: TreeItemCollapsibleState) {
		super(label, collapsibleState);
	}
}
