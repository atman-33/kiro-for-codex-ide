import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, MessageItem } from "vscode";
import { Uri, ViewColumn, window, workspace } from "vscode";
import { CreateSteeringInputController } from "./create-steering-input-controller";
import type { CreateSteeringDraftState } from "./types";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { NotificationUtils } from "../../utils/notification-utils";

vi.mock("../../utils/chat-prompt-runner", () => ({
	sendPromptToChat: vi.fn(),
}));

vi.mock("../../utils/notification-utils", () => ({
	// biome-ignore lint/style/useNamingConvention: ignore
	NotificationUtils: {
		showAutoDismissNotification: vi.fn(),
	},
}));

describe("CreateSteeringInputController", () => {
	let context: ExtensionContext;
	let postMessageMock: ReturnType<typeof vi.fn>;
	let revealMock: ReturnType<typeof vi.fn>;
	let disposeMock: ReturnType<typeof vi.fn>;
	let onDidDisposeMock: ReturnType<typeof vi.fn>;
	let onDidReceiveMessageMock: ReturnType<typeof vi.fn>;
	let workspaceStateGetMock: ReturnType<typeof vi.fn>;
	let workspaceStateUpdateMock: ReturnType<typeof vi.fn>;
	let configManager: { getPath: ReturnType<typeof vi.fn> };
	let promptLoader: { renderPrompt: ReturnType<typeof vi.fn> };
	let outputChannel: { appendLine: ReturnType<typeof vi.fn> };
	let htmlValue: string;
	let messageHandler:
		| ((
				message:
					| { type: "create-steering/submit"; payload: any }
					| { type: "create-steering/autosave"; payload: any }
					| {
							type: "create-steering/close-attempt";
							payload: { hasDirtyChanges: boolean };
					  }
					| { type: "create-steering/cancel" }
					| { type: "create-steering/ready" }
		  ) => Promise<void>)
		| undefined;

	const createMessageItem = (title: string): MessageItem => ({ title });

	const createController = () =>
		new CreateSteeringInputController({
			context,
			configManager: configManager as any,
			promptLoader: promptLoader as any,
			outputChannel: outputChannel as any,
		});

	beforeEach(() => {
		vi.clearAllMocks();
		htmlValue = "";
		messageHandler = undefined;

		workspaceStateGetMock = vi.fn();
		workspaceStateUpdateMock = vi.fn();

		context = {
			extensionUri: Uri.parse("file:///extension"),
			workspaceState: {
				get: workspaceStateGetMock,
				update: workspaceStateUpdateMock,
			},
			subscriptions: [],
		} as unknown as ExtensionContext;

		configManager = {
			getPath: vi.fn().mockReturnValue(".codex/steering"),
		};

		promptLoader = {
			renderPrompt: vi.fn().mockReturnValue("steering-prompt"),
		};

		outputChannel = {
			appendLine: vi.fn(),
		};

		postMessageMock = vi.fn().mockResolvedValue(true);
		revealMock = vi.fn();
		disposeMock = vi.fn();
		onDidDisposeMock = vi.fn((callback: () => void) => ({
			dispose: vi.fn(() => {
				callback();
			}),
		}));

		onDidReceiveMessageMock = vi.fn(
			(
				handler: (
					message:
						| { type: "create-steering/submit"; payload: any }
						| { type: "create-steering/autosave"; payload: any }
						| {
								type: "create-steering/close-attempt";
								payload: { hasDirtyChanges: boolean };
						  }
						| { type: "create-steering/cancel" }
						| { type: "create-steering/ready" }
				) => Promise<void>
			) => {
				messageHandler = handler;
				return { dispose: vi.fn() };
			}
		);

		const webview = {
			asWebviewUri: vi.fn((resource) => resource),
			cspSource: "mock-csp",
			postMessage: postMessageMock,
			onDidReceiveMessage: onDidReceiveMessageMock,
		} as any;

		Object.defineProperty(webview, "html", {
			get: () => htmlValue,
			set: (value: string) => {
				htmlValue = value;
			},
		});

		const panel = {
			webview,
			reveal: revealMock,
			dispose: disposeMock,
			onDidDispose: onDidDisposeMock,
		} as any;

		(window as any).createWebviewPanel = vi.fn(() => panel);
		vi.mocked(sendPromptToChat).mockResolvedValue(undefined);
		(window as any).showWarningMessage = window.showWarningMessage;
		vi.mocked(window.showWarningMessage).mockResolvedValue(
			createMessageItem("Cancel")
		);
		vi.mocked(workspace.fs.createDirectory).mockResolvedValue(undefined);
	});

	const emitMessage = async (message: any) => {
		if (!messageHandler) {
			throw new Error("message handler not registered");
		}
		await messageHandler(message);
	};

	it("opens panel and posts init message with focus flag", async () => {
		const controller = createController();
		await controller.open();

		expect((window as any).createWebviewPanel).toHaveBeenCalledWith(
			"kiro.createSteeringDialog",
			"Create Custom Steering",
			{
				viewColumn: ViewColumn.Active,
				preserveFocus: false,
			},
			expect.objectContaining({
				enableScripts: true,
				retainContextWhenHidden: true,
			})
		);
		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-steering/init",
			payload: {
				draft: undefined,
				shouldFocusPrimaryField: true,
			},
		});
		expect(htmlValue).toContain('data-page="create-steering"');
	});

	it("restores saved draft state when available", async () => {
		const draft: CreateSteeringDraftState = {
			formData: {
				summary: "Saved summary",
				audience: "frontend team",
				keyPractices: "Follow hooks rules",
				antiPatterns: "Avoid console logs",
			},
			lastUpdated: 999,
		};

		workspaceStateGetMock.mockReturnValueOnce(draft);

		const controller = createController();
		await controller.open();

		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-steering/init",
			payload: {
				draft,
				shouldFocusPrimaryField: true,
			},
		});
	});

	it("submits steering prompt with normalized payload", async () => {
		const controller = createController();
		await controller.open();

		await emitMessage({
			type: "create-steering/submit",
			payload: {
				summary: "  Improve API docs ",
				audience: "API team",
				keyPractices: "Document request/response examples",
				antiPatterns: "Skipping error cases",
			},
		});

		expect(workspace.fs.createDirectory).toHaveBeenCalledWith(
			expect.objectContaining({
				fsPath: "/fake/workspace/.codex/steering",
			})
		);
		expect(promptLoader.renderPrompt).toHaveBeenCalledWith(
			"create-custom-steering",
			expect.objectContaining({
				description: expect.stringContaining(
					"Guidance Summary:\nImprove API docs"
				),
				steeringPath: ".codex/steering",
			})
		);
		expect(sendPromptToChat).toHaveBeenCalledWith("steering-prompt");
		expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalled();
		expect(workspaceStateUpdateMock).toHaveBeenCalledWith(
			"createSteeringDraftState",
			undefined
		);
		expect(disposeMock).toHaveBeenCalled();
	});

	it("returns validation error when summary missing", async () => {
		const controller = createController();
		await controller.open();

		await emitMessage({
			type: "create-steering/submit",
			payload: {
				summary: "   ",
				audience: "",
				keyPractices: "",
				antiPatterns: "",
			},
		});

		expect(postMessageMock).toHaveBeenLastCalledWith({
			payload: { message: "Guidance summary is required." },
			type: "create-steering/submit:error",
		});
		expect(sendPromptToChat).not.toHaveBeenCalled();
	});

	it("persists autosave drafts and handles close cancellation", async () => {
		const controller = createController();
		await controller.open();

		await emitMessage({
			type: "create-steering/autosave",
			payload: {
				summary: "Partial summary",
				audience: "",
				keyPractices: "",
				antiPatterns: "",
			},
		});

		expect(workspaceStateUpdateMock).toHaveBeenCalledWith(
			"createSteeringDraftState",
			expect.objectContaining({
				formData: expect.objectContaining({ summary: "Partial summary" }),
			})
		);

		await emitMessage({
			type: "create-steering/close-attempt",
			payload: { hasDirtyChanges: true },
		});

		expect(postMessageMock).toHaveBeenLastCalledWith({
			type: "create-steering/confirm-close",
			payload: { shouldClose: false },
		});
	});
});
