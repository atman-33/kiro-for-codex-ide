import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileType, window, workspace } from "vscode";
import { PromptLoader } from "../../services/prompt-loader";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { NotificationUtils } from "../../utils/notification-utils";
import { SpecManager } from "./spec-manager";

// Mock dependencies
vi.mock("../../services/prompt-loader", () => {
	const mockRenderPrompt = vi.fn();
	return {
		// biome-ignore lint/style/useNamingConvention: ignore
		PromptLoader: {
			getInstance: () => ({
				renderPrompt: mockRenderPrompt,
			}),
		},
	};
});
vi.mock("../../utils/chat-prompt-runner");
vi.mock("../../utils/notification-utils");

describe("SpecManager", () => {
	let specManager: SpecManager;
	const mockOutputChannel = { appendLine: vi.fn() } as any;

	beforeEach(() => {
		vi.clearAllMocks();
		specManager = new SpecManager(mockOutputChannel);
		vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);
	});

	// 1. Happy Path: Test that getSpecList returns a list of directories.
	it("should return a list of spec directories", async () => {
		const mockEntries = [
			["spec1", FileType.Directory],
			["spec2", FileType.Directory],
			["file1.txt", FileType.File],
		] as [string, any][];

		vi.mocked(workspace.fs.stat).mockRejectedValue(new Error("Not found"));
		vi.mocked(workspace.fs.readDirectory).mockResolvedValue(mockEntries);

		const specList = await specManager.getSpecList();

		expect(specList).toEqual(["spec1", "spec2"]);
		expect(workspace.fs.readDirectory).toHaveBeenCalled();
	});

	// 2. Edge Case: Test delete when the file system operation fails.
	it("should show an error message when deletion fails", async () => {
		const error = new Error("Deletion failed");
		vi.mocked(workspace.fs.delete).mockRejectedValue(error);

		await specManager.delete("spec-to-delete");

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			`Failed to delete spec: ${error}`
		);
		expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
			`[SpecManager] Failed to delete spec: ${error}`
		);
	});

	// 3. Fail Safe / Mocks: Test the create method.
	it("should render and send a prompt to chat on create", async () => {
		const description = "My new feature idea";
		const prompt = "Generated prompt";

		vi.mocked(window.showInputBox).mockResolvedValue(description);
		const mockedPromptLoader = PromptLoader.getInstance();
		vi.mocked(mockedPromptLoader.renderPrompt).mockReturnValue(prompt);

		await specManager.create();

		expect(window.showInputBox).toHaveBeenCalled();
		expect(mockedPromptLoader.renderPrompt).toHaveBeenCalledWith(
			"create-spec",
			{
				description,
				workspacePath: "/fake/workspace",
				specBasePath: ".codex/specs",
			}
		);
		expect(sendPromptToChat).toHaveBeenCalledWith(prompt);
		expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalled();
	});
});
