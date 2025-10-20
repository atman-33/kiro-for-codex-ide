import {
	type ExtensionContext,
	type OutputChannel,
	Uri,
	ViewColumn,
	type WebviewPanel,
	window,
	workspace,
} from "vscode";
import type { PromptLoader } from "../../services/prompt-loader";
import { sendPromptToChat } from "../../utils/chat-prompt-runner";
import type { ConfigManager } from "../../utils/config-manager";
import { getWebviewContent } from "../../utils/get-webview-content";
import { NotificationUtils } from "../../utils/notification-utils";

type CreateSpecInputControllerDependencies = {
	context: ExtensionContext;
	configManager: ConfigManager;
	promptLoader: PromptLoader;
	outputChannel: OutputChannel;
};

type CreateSpecFormData = {
	summary: string;
	productContext?: string;
	technicalConstraints?: string;
	openQuestions?: string;
};

type CreateSpecMessage =
	| {
			type: "create-spec/submit";
			payload: CreateSpecFormData;
	  }
	| { type: "create-spec/ready" }
	| { type: "create-spec/cancel" };

const formatDescription = (data: CreateSpecFormData): string => {
	const sections = [
		`Summary:\n${data.summary.trim()}`,
		data.productContext?.trim()
			? `Product Context:\n${data.productContext.trim()}`
			: undefined,
		data.technicalConstraints?.trim()
			? `Technical Constraints:\n${data.technicalConstraints.trim()}`
			: undefined,
		data.openQuestions?.trim()
			? `Open Questions:\n${data.openQuestions.trim()}`
			: undefined,
	].filter(Boolean);

	return sections.join("\n\n");
};

export class CreateSpecInputController {
	private readonly context: ExtensionContext;
	private readonly configManager: ConfigManager;
	private readonly promptLoader: PromptLoader;
	private readonly outputChannel: OutputChannel;
	private panel: WebviewPanel | undefined;

	constructor({
		context,
		configManager,
		promptLoader,
		outputChannel,
	}: CreateSpecInputControllerDependencies) {
		this.context = context;
		this.configManager = configManager;
		this.promptLoader = promptLoader;
		this.outputChannel = outputChannel;
	}

	// biome-ignore lint/suspicious/useAwait: ignore
	open = async (): Promise<void> => {
		if (this.panel) {
			this.panel.reveal(ViewColumn.Active, false);
			this.postFocusMessage();
			return;
		}

		const workspaceFolder = workspace.workspaceFolders?.[0];
		if (!workspaceFolder) {
			window.showErrorMessage("No workspace folder open");
			return;
		}

		this.panel = this.createPanel();
		if (!this.panel) {
			window.showErrorMessage("Unable to open Create Spec dialog");
			return;
		}

		this.registerPanelListeners(this.panel);
		this.panel.webview.html = getWebviewContent(
			this.panel.webview,
			this.context.extensionUri,
			"create-spec"
		);
		this.postInitMessage();
	};

	private readonly createPanel = (): WebviewPanel | undefined => {
		const resourceRoots = [
			Uri.joinPath(this.context.extensionUri, "dist", "webview"),
			Uri.joinPath(this.context.extensionUri, "dist", "webview", "app"),
		];

		try {
			return window.createWebviewPanel(
				"kiro.createSpecDialog",
				"Create New Spec",
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
				`[CreateSpecInputController] Failed to open modal panel: ${error}`
			);
			try {
				return window.createWebviewPanel(
					"kiro.createSpecPanel",
					"Create New Spec",
					ViewColumn.Active,
					{
						enableScripts: true,
						retainContextWhenHidden: true,
						localResourceRoots: resourceRoots,
					}
				);
			} catch (fallbackError) {
				this.outputChannel.appendLine(
					`[CreateSpecInputController] Fallback panel creation failed: ${fallbackError}`
				);
				return;
			}
		}
	};

	private readonly registerPanelListeners = (panel: WebviewPanel): void => {
		panel.onDidDispose(() => {
			this.panel = undefined;
		});

		panel.webview.onDidReceiveMessage(async (message: CreateSpecMessage) => {
			if (message.type === "create-spec/submit") {
				await this.handleSubmit(message.payload);
				return;
			}

			if (message.type === "create-spec/cancel") {
				panel.dispose();
			}
		});
	};

	private readonly postInitMessage = (): void => {
		if (!this.panel) {
			return;
		}

		this.panel.webview.postMessage({
			type: "create-spec/init",
			payload: {
				shouldFocusPrimaryField: true,
			},
		});
	};

	private readonly postFocusMessage = (): void => {
		if (!this.panel) {
			return;
		}

		this.panel.webview.postMessage({
			type: "create-spec/focus",
		});
	};

	private readonly handleSubmit = async (
		data: CreateSpecFormData
	): Promise<void> => {
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
			this.panel.webview.postMessage({
				type: "create-spec/submit:error",
				payload: { message: "Summary is required." },
			});
			return;
		}

		const payload = formatDescription({
			...data,
			summary: sanitizedSummary,
		});

		try {
			const prompt = this.promptLoader.renderPrompt("create-spec", {
				description: payload,
				workspacePath: workspaceFolder.uri.fsPath,
				specBasePath: this.configManager.getPath("specs"),
			});

			await sendPromptToChat(prompt);
			NotificationUtils.showAutoDismissNotification(
				"Sent the spec creation prompt to ChatGPT. Continue the flow there."
			);

			this.panel.webview.postMessage({
				type: "create-spec/submit:success",
			});
			this.panel.dispose();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.outputChannel.appendLine(
				`[CreateSpecInputController] Failed to submit spec request: ${message}`
			);

			this.panel.webview.postMessage({
				type: "create-spec/submit:error",
				payload: { message },
			});
			window.showErrorMessage(`Failed to create spec prompt: ${message}`);
		}
	};
}
