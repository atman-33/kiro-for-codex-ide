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
