import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { FileType, Uri, workspace } from "vscode";
import { PromptLoader } from "../../services/prompt-loader";
import { ConfigManager } from "../../utils/config-manager";
import { SteeringManager } from "./steering-manager";

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
const { openMock, createSteeringInputControllerMock } = vi.hoisted(() => {
	const open = vi.fn();
	return {
		openMock: open,
		createSteeringInputControllerMock: vi.fn(() => ({
			open,
		})),
	};
});
vi.mock("./create-steering-input-controller", () => ({
	// biome-ignore lint/style/useNamingConvention: ignore
	CreateSteeringInputController: createSteeringInputControllerMock,
}));

describe("SteeringManager", () => {
	let steeringManager: SteeringManager;
	const mockCodexProvider = { invokeCodexHeadless: vi.fn() } as any;
	const mockOutputChannel = { appendLine: vi.fn() } as any;
	let mockContext: ExtensionContext;

	beforeEach(() => {
		vi.clearAllMocks();
		openMock.mockClear();
		createSteeringInputControllerMock.mockClear();
		mockContext = {
			extensionUri: Uri.parse("file:///extension"),
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
			},
			subscriptions: [],
		} as unknown as ExtensionContext;
		steeringManager = new SteeringManager(
			mockContext,
			mockCodexProvider,
			mockOutputChannel
		);
		vi.mocked(workspace.fs.stat).mockResolvedValue({} as any);
	});

	// 1. Happy Path: Test that getSteeringDocuments returns a list of markdown files.
	it("should return a list of steering documents", async () => {
		const mockEntries = [
			["doc1.md", FileType.File],
			["doc2.md", FileType.File],
			["other.txt", FileType.File],
		] as [string, any][];

		vi.mocked(workspace.fs.readDirectory).mockResolvedValue(mockEntries);

		const documents = await steeringManager.getSteeringDocuments();

		expect(documents).toHaveLength(2);
		expect(documents[0].name).toBe("doc1");
		expect(documents[1].name).toBe("doc2");
	});

	// 2. Edge Case: Test delete when codexProvider fails.
	it("should return an error when codexProvider fails during delete", async () => {
		const error = new Error("Codex failed");
		mockCodexProvider.invokeCodexHeadless.mockResolvedValue({
			exitCode: 1,
			error,
		});

		const result = await steeringManager.delete("doc1", "/path/to/doc1.md");

		expect(result.success).toBe(false);
		expect(result.error).toContain("Failed to update AGENTS.md");
	});

	// 3. Fail Safe / Mocks: Test the createCustom method.
	it("should delegate to input controller on createCustom", async () => {
		await steeringManager.createCustom();

		expect(createSteeringInputControllerMock).toHaveBeenCalledWith({
			context: mockContext,
			configManager: ConfigManager.getInstance(),
			promptLoader: PromptLoader.getInstance(),
			outputChannel: mockOutputChannel,
		});
		expect(openMock).toHaveBeenCalled();
	});
});
