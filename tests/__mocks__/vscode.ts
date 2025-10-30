/** biome-ignore-all lint/style/useNamingConvention: ignore */
import { vi } from "vitest";

export const workspace = {
	workspaceFolders: [
		{
			uri: {
				fsPath: "/fake/workspace",
				with: vi.fn(),
				toString: () => "file:///fake/workspace",
			},
		},
	],
	getConfiguration: vi.fn(() => ({
		get: vi.fn(),
	})),
	fs: {
		createDirectory: vi.fn(),
		writeFile: vi.fn(),
		readDirectory: vi.fn(),
		stat: vi.fn(),
		delete: vi.fn(),
	},
	openTextDocument: vi.fn(),
	onDidChangeConfiguration: vi.fn(),
};

export const window = {
	activeTextEditor: undefined,
	visibleTextEditors: [],
	showTextDocument: vi.fn(),
	withProgress: vi.fn((options, task) => task()),
	showErrorMessage: vi.fn(),
	showWarningMessage: vi.fn(),
	showInformationMessage: vi.fn(),
	showInputBox: vi.fn(),
	createTerminal: vi.fn(),
	onDidEndTerminalShellExecution: vi.fn(),
};

export const commands = {
	executeCommand: vi.fn(),
};

export const Uri = {
	file: vi.fn((path) => ({
		fsPath: path,
		with: vi.fn(),
		toString: () => `file://${path}`,
	})),
	joinPath: vi.fn((base, ...args) => {
		const path = [base.fsPath, ...args].join("/");
		return {
			fsPath: path,
			with: vi.fn(),
			toString: () => `file://${path}`,
		};
	}),
	parse: vi.fn((str) => ({
		toString: () => str,
		fsPath: str.replace("file://", ""),
	})),
};

export const ViewColumn = {
	Active: 1,
	Beside: 2,
	One: 1,
	Two: 2,
	Three: 3,
	Four: 4,
	Five: 5,
	Six: 6,
	Seven: 7,
	Eight: 8,
	Nine: 9,
};

export const Position = vi.fn();
export const Range = vi.fn();
export const Selection = vi.fn();

export const ProgressLocation = {
	Notification: 15,
};

export const FileType = {
	Unknown: 0,
	File: 1,
	Directory: 2,
	SymbolicLink: 64,
};

export const TextEditorRevealType = {
	Default: 0,
};

export const TreeItemCollapsibleState = {
	None: 0,
	Collapsed: 1,
	Expanded: 2,
} as const;
export type TreeItemCollapsibleState =
	(typeof TreeItemCollapsibleState)[keyof typeof TreeItemCollapsibleState];

export class ThemeIcon {
	readonly id: string;

	constructor(id: string) {
		this.id = id;
	}
}

export class TreeItem {
	label: string;
	collapsibleState: TreeItemCollapsibleState;
	iconPath: ThemeIcon | undefined;
	tooltip: string | undefined;
	description: string | undefined;
	command: unknown;
	resourceUri: { fsPath: string } | undefined;

	constructor(label: string, collapsibleState: TreeItemCollapsibleState) {
		this.label = label;
		this.collapsibleState = collapsibleState;
	}
}

export class EventEmitter<T> {
	private readonly listeners: Array<(event: T) => void> = [];

	readonly event = (listener: (event: T) => void) => {
		this.listeners.push(listener);
		return {
			dispose: vi.fn(() => {
				const index = this.listeners.indexOf(listener);
				if (index >= 0) {
					this.listeners.splice(index, 1);
				}
			}),
		};
	};

	fire = (event: T): void => {
		for (const listener of [...this.listeners]) {
			listener(event);
		}
	};

	dispose = vi.fn(() => {
		this.listeners.length = 0;
	});
}
