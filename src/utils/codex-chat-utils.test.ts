import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands, Position, Selection, Uri, window, workspace } from "vscode";
import { addDocumentToCodexChat } from "./codex-chat-utils";

describe("codex-chat-utils", () => {
	const mockUri = Uri.parse("file:///fake/document.txt");
	const mockDocument = {
		uri: mockUri,
		lineCount: 10,
		lineAt: vi.fn(() => ({ range: { end: new Position(0, 0) } })),
	};
	const mockEditor = {
		document: mockDocument,
		selection: new Selection(new Position(0, 0), new Position(0, 0)),
		revealRange: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		window.activeTextEditor = undefined;
		window.visibleTextEditors = [];
		vi.mocked(window.showTextDocument).mockResolvedValue(mockEditor as any);
		vi.mocked(workspace.openTextDocument).mockResolvedValue(
			mockDocument as any
		);
	});

	// 1. Happy Path: Test that addDocumentToCodexChat calls the correct command.
	it("should select the document and execute the add to chat command", async () => {
		// @ts-expect-error
		window.activeTextEditor = mockEditor;
		await addDocumentToCodexChat(mockUri);
		expect(commands.executeCommand).toHaveBeenCalledWith("chatgpt.addToThread");
	});

	// 2. Edge Case: Test selectEntireDocument when the editor is visible but not active.
	it("should switch to the correct editor if it is visible but not active", async () => {
		const otherEditor = {
			...mockEditor,
			document: { ...mockDocument, uri: Uri.parse("file:///other.txt") },
		};
		window.activeTextEditor = otherEditor as any;
		window.visibleTextEditors = [mockEditor] as any;

		await addDocumentToCodexChat(mockUri);

		expect(window.showTextDocument).toHaveBeenCalledWith(
			mockDocument,
			expect.any(Object)
		);
		expect(commands.executeCommand).toHaveBeenCalledWith("chatgpt.addToThread");
	});

	// 3. Fail Safe / Mocks: Test selectEntireDocument when the document is not open.
	it("should open the document if it is not already visible", async () => {
		await addDocumentToCodexChat(mockUri);

		expect(workspace.openTextDocument).toHaveBeenCalledWith(mockUri);
		expect(window.showTextDocument).toHaveBeenCalledWith(
			mockDocument,
			expect.any(Object)
		);
		expect(commands.executeCommand).toHaveBeenCalledWith("chatgpt.addToThread");
	});
});
