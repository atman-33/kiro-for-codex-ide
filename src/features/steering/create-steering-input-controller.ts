import { join } from "path";
import {
	type ExtensionContext,
	type MessageItem,
	type OutputChannel,
	Uri,
	ViewColumn,
	type WebviewPanel,
	window,
	workspace,
} from "vscode";
import type { PromptLoader } from "../../services/prompt-loader";
import type { ConfigManager } from "../../utils/config-manager";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import { getWebviewContent } from "../../utils/get-webview-content";
import { NotificationUtils } from "../../utils/notification-utils";
import type {
	CreateSteeringDraftState,
	CreateSteeringExtensionMessage,
	CreateSteeringFormData,
	CreateSteeringWebviewMessage,
} from "./types";

type CreateSteeringInputControllerDependencies = {
	context: ExtensionContext;
	configManager: ConfigManager;
	promptLoader: PromptLoader;
	outputChannel: OutputChannel;
};

const CREATE_STEERING_DRAFT_STATE_KEY = "createSteeringDraftState";

const isMessageItem = (value: unknown): value is MessageItem => {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as { title?: unknown };
	return typeof candidate.title === "string";
};

const normalizeFormData = (
	data: CreateSteeringFormData
): CreateSteeringFormData => ({
	summary: data.summary ?? "",
	audience: data.audience ?? "",
	keyPractices: data.keyPractices ?? "",
	antiPatterns: data.antiPatterns ?? "",
});

const formatDescription = (data: CreateSteeringFormData): string => {
	const sections = [
		`Guidance Summary:\n${data.summary.trim()}`,
		data.audience.trim()
			? `Audience & Ownership:\n${data.audience.trim()}`
			: undefined,
		data.keyPractices.trim()
			? `Key Practices to Follow:\n${data.keyPractices.trim()}`
			: undefined,
		data.antiPatterns.trim()
			? `Pitfalls to Avoid:\n${data.antiPatterns.trim()}`
			: undefined,
	].filter(Boolean);

	return sections.join("\n\n");
};

export class CreateSteeringInputController {
	private readonly context: ExtensionContext;
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly outputChannel: OutputChannel;
	private draft: CreateSteeringDraftState | undefined;
	private panel: WebviewPanel | undefined;

	constructor({
		context,
		configManager,
		promptLoader,
		outputChannel,
	}: CreateSteeringInputControllerDependencies) {
		this.context = context;
		this.configManager = configManager;
		this.promptLoader = promptLoader;
		this.outputChannel = outputChannel;
	}

	async open(): Promise<void> {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Active, false);
			await this.postFocusMessage();
			return;
		}

		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		this.draft = this.getDraftState();

		this.panel = this.createPanel();
		if (!this.panel) {
			window.showErrorMessage("Unable to open Create Steering dialog");
			return;
		}

		this.registerPanelListeners(this.panel);
		this.panel.webview.html = getWebviewContent(
			this.panel.webview,
			this.context.extensionUri,
			"create-steering"
		);
		await this.postInitMessage();
	}

	private createPanel(): WebviewPanel | undefined {
		const resourceRoots = [
			Uri.joinPath(this.context.extensionUri, "dist", "webview"),
			Uri.joinPath(this.context.extensionUri, "dist", "webview", "app"),
		];

		try {
			return window.createWebviewPanel(
				"kiro.createSteeringDialog",
				"Create Custom Steering",
				{
					viewColumn: ViewColumn.Active,
					preserveFocus: false,
				},
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: resourceRoots,
				}
			);
		} catch (error) {
			this.outputChannel.appendLine(
				`[CreateSteeringInputController] Failed to open modal panel: ${error}`
			);
			try {
				return window.createWebviewPanel(
					"kiro.createSteeringPanel",
					"Create Custom Steering",
					ViewColumn.Active,
					{
						enableScripts: true,
						retainContextWhenHidden: true,
						localResourceRoots: resourceRoots,
					}
				);
			} catch (fallbackError) {
				this.outputChannel.appendLine(
					`[CreateSteeringInputController] Fallback panel creation failed: ${fallbackError}`
				);
				return;
			}
		}
	}

	private registerPanelListeners(panel: WebviewPanel): void {
		panel.onDidDispose(() => {
			this.panel = undefined;
		});

		panel.webview.onDidReceiveMessage(
			async (message: CreateSteeringWebviewMessage) => {
				if (message.type === "create-steering/submit") {
					await this.handleSubmit(message.payload);
					return;
				}

				if (message.type === "create-steering/autosave") {
					await this.handleAutosave(message.payload);
					return;
				}

				if (message.type === "create-steering/close-attempt") {
					await this.handleCloseAttempt(message.payload.hasDirtyChanges);
					return;
				}

				if (message.type === "create-steering/cancel") {
					panel.dispose();
				}
			}
		);
	}

	private async postInitMessage(): Promise<void> {
		if (!this.panel) {
			return;
		}

		const message: CreateSteeringExtensionMessage = {
			type: "create-steering/init",
			payload: {
				draft: this.draft,
				shouldFocusPrimaryField: true,
			},
		};

		await this.panel.webview.postMessage(message);
	}

	private async postFocusMessage(): Promise<void> {
		if (!this.panel) {
			return;
		}

		const message: CreateSteeringExtensionMessage = {
			type: "create-steering/focus",
		};

		await this.panel.webview.postMessage(message);
	}

	private async handleSubmit(data: CreateSteeringFormData): Promise<void> {
		if (!this.panel) {
			return;
		}

		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		const sanitizedSummary = data.summary?.trim();
		if (!sanitizedSummary) {
			await this.panel.webview.postMessage({
				type: "create-steering/submit:error",
				payload: { message: "Guidance summary is required." },
			});
			return;
		}

		const normalized = normalizeFormData({
			...data,
			summary: sanitizedSummary,
		});

		const payload = formatDescription(normalized);

		const steeringRelativePath = this.configManager.getPath("steering");
		const steeringPath = join(workspaceFolder.uri.fsPath, steeringRelativePath);

		try {
			await workspace.fs.createDirectory(Uri.file(steeringPath));

			const prompt = this.promptLoader.renderPrompt("create-custom-steering", {
				description: payload,
				steeringPath: steeringRelativePath,
			});

			await sendPromptToChat(prompt);
			NotificationUtils.showAutoDismissNotification(
				"Sent the steering creation prompt to ChatGPT. Continue the conversation there."
			);

			await this.clearDraftState();

			await this.panel.webview.postMessage({
				type: "create-steering/submit:success",
			});
			this.panel.dispose();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[CreateSteeringInputController] Failed to submit steering request: ${message}`
			);

			await this.panel.webview.postMessage({
				type: "create-steering/submit:error",
				payload: { message },
			});
			window.showErrorMessage(`Failed to create steering prompt: ${message}`);
		}
	}

	private async handleAutosave(data: CreateSteeringFormData): Promise<void> {
		this.draft = {
			formData: normalizeFormData(data),
			lastUpdated: Date.now(),
		};
		await this.saveDraftState(this.draft);
	}

	private async handleCloseAttempt(hasDirtyChanges: boolean): Promise<void> {
		if (!this.panel) {
			return;
		}

		if (!hasDirtyChanges) {
			await this.clearDraftState();
			this.panel.dispose();
			return;
		}

		const result = await window.showWarningMessage(
			"You have unsaved steering input. Close the dialog and discard your changes?",
			{
				modal: true,
				detail: "Choose Cancel to resume editing and keep your current input.",
			},
			"Discard"
		);

		const selection = isMessageItem(result) ? result.title : result;
		const shouldClose = selection === "Discard";

		if (shouldClose) {
			await this.clearDraftState();
			this.panel.dispose();
			return;
		}

		await this.panel.webview.postMessage({
			type: "create-steering/confirm-close",
			payload: { shouldClose: false },
		});
	}

	private getDraftState(): CreateSteeringDraftState | undefined {
		return this.context.workspaceState.get<CreateSteeringDraftState>(
			CREATE_STEERING_DRAFT_STATE_KEY
		);
	}

	private async saveDraftState(state: CreateSteeringDraftState): Promise<void> {
		await this.context.workspaceState.update(
			CREATE_STEERING_DRAFT_STATE_KEY,
			state
		);
	}

	private async clearDraftState(): Promise<void> {
		this.draft = undefined;
		await this.context.workspaceState.update(
			CREATE_STEERING_DRAFT_STATE_KEY,
			undefined
		);
	}
}
