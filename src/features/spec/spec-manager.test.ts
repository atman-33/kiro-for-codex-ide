import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { FileType, Uri, window, workspace } from "vscode";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
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
const { openMock, createSpecInputControllerMock } = vi.hoisted(() => {
	const open = vi.fn();
	return {
		openMock: open,
		createSpecInputControllerMock: vi.fn(() => ({
			open,
		})),
	};
});
vi.mock("./create-spec-input-controller", () => ({
	// biome-ignore lint/style/useNamingConvention: ignore
	CreateSpecInputController: createSpecInputControllerMock,
}));

describe("SpecManager", () => {
	let specManager: SpecManager;
	let mockContext: ExtensionContext;
	const mockOutputChannel = { appendLine: vi.fn() } as any;

	beforeEach(() => {
		vi.clearAllMocks();
		openMock.mockClear();
		createSpecInputControllerMock.mockClear();
		mockContext = {
			extensionUri: Uri.parse("file:///extension"),
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			subscriptions: [],
		} as unknown as ExtensionContext;
		specManager = new SpecManager(mockContext, mockOutputChannel);
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
		await specManager.create();

		expect(createSpecInputControllerMock).toHaveBeenCalledWith({
			context: mockContext,
			configManager: ConfigManager.getInstance(),
			promptLoader: PromptLoader.getInstance(),
			outputChannel: mockOutputChannel,
		});
		expect(openMock).toHaveBeenCalled();
	});
});
