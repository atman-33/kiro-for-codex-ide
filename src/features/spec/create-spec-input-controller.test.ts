import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, MessageItem } from "vscode";
import { Uri, ViewColumn, window } from "vscode";
import { CreateSpecInputController } from "./create-spec-input-controller";
import type { CreateSpecDraftState } from "./types";
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

describe("CreateSpecInputController", () => {
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
					| { type: "create-spec/submit"; payload: any }
					| { type: "create-spec/autosave"; payload: any }
					| {
							type: "create-spec/close-attempt";
							payload: { hasDirtyChanges: boolean };
					  }
					| { type: "create-spec/cancel" }
					| { type: "create-spec/ready" }
		  ) => Promise<void>)
		| undefined;

	const createMessageItem = (title: string): MessageItem => ({ title });

	const createController = () =>
		new CreateSpecInputController({
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
			getPath: vi.fn().mockReturnValue(".codex/specs"),
		};

		promptLoader = {
			renderPrompt: vi.fn().mockReturnValue("prompt-content"),
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
						| { type: "create-spec/submit"; payload: any }
						| { type: "create-spec/autosave"; payload: any }
						| {
								type: "create-spec/close-attempt";
								payload: { hasDirtyChanges: boolean };
						  }
						| { type: "create-spec/cancel" }
						| { type: "create-spec/ready" }
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
			"kiro.createSpecDialog",
			"Create New Spec",
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
			type: "create-spec/init",
			payload: {
				draft: undefined,
				shouldFocusPrimaryField: true,
			},
		});
	});

	it("loads the create-spec webview bundle", async () => {
		const controller = createController();
		await controller.open();

		expect(htmlValue).toContain('data-page="create-spec"');
	});

	it("restores saved draft state when available", async () => {
		const draft: CreateSpecDraftState = {
			formData: {
				summary: "Saved summary",
				productContext: "Saved product context",
				technicalConstraints: "",
				openQuestions: "",
			},
			lastUpdated: 123,
		};

		workspaceStateGetMock.mockReturnValueOnce(draft);

		const controller = createController();
		await controller.open();

		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-spec/init",
			payload: {
				draft,
				shouldFocusPrimaryField: true,
			},
		});
	});

	it("submits form data and clears draft state on success", async () => {
		const controller = createController();
		await controller.open();

		await emitMessage({
			type: "create-spec/submit",
			payload: {
				summary: " Feature idea ",
				productContext: "Context",
				technicalConstraints: "",
				openQuestions: "",
			},
		});

		expect(promptLoader.renderPrompt).toHaveBeenCalledWith(
			"create-spec",
			expect.objectContaining({
				description: expect.stringContaining("Summary:\nFeature idea"),
				workspacePath: "/fake/workspace",
				specBasePath: ".codex/specs",
			})
		);
		expect(sendPromptToChat).toHaveBeenCalledWith("prompt-content");
		expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalled();
		expect(workspaceStateUpdateMock).toHaveBeenCalledWith(
			"createSpecDraftState",
			undefined
		);
		expect(disposeMock).toHaveBeenCalled();
	});

	it("handles autosave messages by storing draft state", async () => {
		const controller = createController();
		await controller.open();

		// biome-ignore lint/style/noMagicNumbers: ignore
		const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

		await emitMessage({
			type: "create-spec/autosave",
			payload: {
				summary: "Draft summary",
				productContext: "",
				technicalConstraints: "Constraints",
				openQuestions: "",
			},
		});

		expect(workspaceStateUpdateMock).toHaveBeenCalledWith(
			"createSpecDraftState",
			{
				formData: {
					summary: "Draft summary",
					productContext: "",
					technicalConstraints: "Constraints",
					openQuestions: "",
				},
				lastUpdated: 1_700_000_000_000,
			}
		);

		nowSpy.mockRestore();
	});

	it("closes panel immediately when there are no dirty changes", async () => {
		const controller = createController();
		await controller.open();

		await emitMessage({
			type: "create-spec/close-attempt",
			payload: { hasDirtyChanges: false },
		});

		expect(workspaceStateUpdateMock).toHaveBeenCalledWith(
			"createSpecDraftState",
			undefined
		);
		expect(disposeMock).toHaveBeenCalled();
		expect(window.showWarningMessage).not.toHaveBeenCalled();
	});

	it("keeps panel open when user cancels closing despite dirty changes", async () => {
		const controller = createController();
		await controller.open();

		vi.mocked(window.showWarningMessage).mockResolvedValueOnce(
			createMessageItem("Cancel")
		);
		postMessageMock.mockClear();

		await emitMessage({
			type: "create-spec/close-attempt",
			payload: { hasDirtyChanges: true },
		});

		expect(window.showWarningMessage).toHaveBeenCalled();
		expect(disposeMock).not.toHaveBeenCalled();
		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-spec/confirm-close",
			payload: { shouldClose: false },
		});
	});

	it("discards draft and closes when user confirms", async () => {
		const controller = createController();
		await controller.open();

		vi.mocked(window.showWarningMessage).mockResolvedValueOnce(
			createMessageItem("Discard")
		);

		await emitMessage({
			type: "create-spec/close-attempt",
			payload: { hasDirtyChanges: true },
		});

		expect(workspaceStateUpdateMock).toHaveBeenCalledWith(
			"createSpecDraftState",
			undefined
		);
		expect(disposeMock).toHaveBeenCalled();
	});

	it("reveals existing panel instead of recreating", async () => {
		const controller = createController();
		await controller.open();

		revealMock.mockClear();
		postMessageMock.mockClear();

		await controller.open();

		expect(revealMock).toHaveBeenCalledWith(ViewColumn.Active, false);
		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-spec/focus",
		});
	});
});
