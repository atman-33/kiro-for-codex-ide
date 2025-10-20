import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { Uri, ViewColumn, window, workspace } from "vscode";
import { CreateSpecInputController } from "./create-spec-input-controller";
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
	let postMessageMock: ReturnType<typeof vi.fn>;
	let revealMock: ReturnType<typeof vi.fn>;
	let disposeMock: ReturnType<typeof vi.fn>;
	let onDidDisposeMock: ReturnType<typeof vi.fn>;
	let onDidReceiveMessageMock: ReturnType<typeof vi.fn>;
	let htmlValue: string;
	let messageHandler:
		| ((
				message:
					| { type: "create-spec/submit"; payload: any }
					| { type: "create-spec/ready" }
					| { type: "create-spec/cancel" }
		  ) => Promise<void>)
		| undefined;
	const context: ExtensionContext = {
		extensionUri: Uri.parse("file:///extension"),
		workspaceState: {
			get: vi.fn(),
			update: vi.fn(),
		},
		subscriptions: [],
	} as unknown as ExtensionContext;
	const configManager = {
		getPath: vi.fn().mockReturnValue(".codex/specs"),
	};
	const promptLoader = {
		renderPrompt: vi.fn().mockReturnValue("prompt-content"),
	};
	const outputChannel = {
		appendLine: vi.fn(),
	};

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

		postMessageMock = vi.fn(() => Promise.resolve(true));
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
						| { type: "create-spec/ready" }
						| { type: "create-spec/cancel" }
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
	});

	const triggerSubmit = async (payload: any) => {
		if (!messageHandler) {
			throw new Error("message handler not registered");
		}
		await messageHandler({ type: "create-spec/submit", payload });
	};

	it("opens a new WebView panel and posts init message", async () => {
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
		expect(htmlValue).toContain('data-page="create-spec"');
		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-spec/init",
			payload: { shouldFocusPrimaryField: true },
		});
	});

	it("reveals existing panel and requests focus", async () => {
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

	it("submits form payload and sends prompt to chat", async () => {
		const controller = createController();
		await controller.open();

		await triggerSubmit({
			summary: "Short summary",
			productContext: "Context details",
		});

		expect(promptLoader.renderPrompt).toHaveBeenCalledWith(
			"create-spec",
			expect.objectContaining({
				description: expect.stringContaining("Summary:\nShort summary"),
				workspacePath: "/fake/workspace",
				specBasePath: ".codex/specs",
			})
		);
		expect(sendPromptToChat).toHaveBeenCalledWith("prompt-content");
		expect(NotificationUtils.showAutoDismissNotification).toHaveBeenCalled();
		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-spec/submit:success",
		});
		expect(disposeMock).toHaveBeenCalled();
	});

	it("returns validation error when summary is missing", async () => {
		const controller = createController();
		await controller.open();

		await triggerSubmit({
			summary: "   ",
		});

		expect(promptLoader.renderPrompt).not.toHaveBeenCalled();
		expect(postMessageMock).toHaveBeenCalledWith({
			type: "create-spec/submit:error",
			payload: { message: "Summary is required." },
		});
		expect(sendPromptToChat).not.toHaveBeenCalled();
	});

	it("falls back to non-modal panel when modal creation fails", async () => {
		const panel = {
			webview: {
				asWebviewUri: vi.fn((resource) => resource),
				cspSource: "mock-csp",
				postMessage: postMessageMock,
				onDidReceiveMessage: onDidReceiveMessageMock,
			},
			reveal: revealMock,
			dispose: disposeMock,
			onDidDispose: onDidDisposeMock,
		} as any;

		Object.defineProperty(panel.webview, "html", {
			get: () => htmlValue,
			set: (value: string) => {
				htmlValue = value;
			},
		});

		const createWebviewPanelMock = vi
			.fn()
			.mockImplementationOnce(() => {
				throw new Error("modal unsupported");
			})
			.mockImplementationOnce(() => panel);

		(window as any).createWebviewPanel = createWebviewPanelMock;

		const controller = createController();
		await controller.open();

		expect(createWebviewPanelMock).toHaveBeenNthCalledWith(
			1,
			"kiro.createSpecDialog",
			"Create New Spec",
			{
				viewColumn: ViewColumn.Active,
				preserveFocus: false,
			},
			expect.any(Object)
		);
		expect(createWebviewPanelMock).toHaveBeenNthCalledWith(
			2,
			"kiro.createSpecPanel",
			"Create New Spec",
			ViewColumn.Active,
			expect.any(Object)
		);
		expect(outputChannel.appendLine).toHaveBeenCalledWith(
			expect.stringContaining("Failed to open modal panel")
		);
	});

	it("shows error message if workspace folder is missing", async () => {
		const originalFolders = workspace.workspaceFolders;
		(workspace as any).workspaceFolders = undefined;

		const controller = createController();
		await controller.open();

		expect(window.showErrorMessage).toHaveBeenCalledWith(
			"No workspace folder open"
		);
		expect((window as any).createWebviewPanel).not.toHaveBeenCalled();

		(workspace as any).workspaceFolders = originalFolders;
	});
});
