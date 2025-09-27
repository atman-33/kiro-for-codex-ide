import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Uri, window, workspace } from "vscode";
import { sendPromptToChat } from "./chat-prompt-runner";
import { addDocumentToCodexChat } from "./codex-chat-utils";

// Mock codex-chat-utils
vi.mock("./codex-chat-utils", () => ({
	addDocumentToCodexChat: vi.fn(),
}));

describe("chat-prompt-runner", () => {
	const originalWorkspaceFolders = workspace.workspaceFolders;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(workspace, "workspaceFolders", "get").mockReturnValue(
			originalWorkspaceFolders
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// 1. Happy Path: Test that sendPromptToChat creates a temporary file and opens it.
	it("should create a temp file and open it in the chat", async () => {
		const prompt = "Test prompt";
		const mockUri = Uri.joinPath(
			workspace.workspaceFolders![0].uri,
			".codex",
			"tmp",
			"chat",
			"prompt.md"
		);
		const mockDocument = { uri: mockUri, getText: () => prompt };

		vi.mocked(workspace.openTextDocument).mockResolvedValue(
			mockDocument as any
		);
		vi.mocked(Uri.joinPath).mockReturnValue(mockUri);

		await sendPromptToChat(prompt);

		expect(workspace.fs.createDirectory).toHaveBeenCalled();
		expect(workspace.fs.writeFile).toHaveBeenCalled();
		expect(workspace.openTextDocument).toHaveBeenCalledWith(mockUri);
		expect(window.showTextDocument).toHaveBeenCalledWith(mockDocument, {
			preview: false,
			viewColumn: 1,
		});
		expect(addDocumentToCodexChat).toHaveBeenCalledWith(mockUri, {
			preview: false,
			viewColumn: 1,
		});
	});

	// 2. Edge Case: Test that sendPromptToChat throws an error if there is no workspace folder.
	it("should throw an error if no workspace folder is available", async () => {
		vi.spyOn(workspace, "workspaceFolders", "get").mockReturnValue(undefined);
		await expect(sendPromptToChat("test")).rejects.toThrow(
			"Workspace folder is required to send prompts to chat."
		);
	});

	// 3. Fail Safe / Mocks: Test that the temporary file has the correct content.
	it("should write the correct content to the temporary file", async () => {
		const prompt = "Here is a test prompt";
		const mockUri = Uri.joinPath(
			workspace.workspaceFolders![0].uri,
			".codex",
			"tmp",
			"chat",
			"prompt.md"
		);
		const mockDocument = { uri: mockUri, getText: () => prompt };

		vi.mocked(workspace.openTextDocument).mockResolvedValue(
			mockDocument as any
		);
		vi.mocked(Uri.joinPath).mockReturnValue(mockUri);

		await sendPromptToChat(prompt);

		expect(workspace.fs.writeFile).toHaveBeenCalledWith(
			mockUri,
			Buffer.from(prompt, "utf8")
		);
	});
});
