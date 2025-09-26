import { type ExtensionContext, commands, window } from "vscode";
import {
	reverseSelection,
	showInformationMessage,
} from "./commands/sample-commands";
import { InteractiveViewProvider } from "./providers/interactive-view-provider";
import { PromptsExplorerProvider } from "./providers/prompts-explorer-provider";
import { SimpleViewProvider } from "./providers/simple-view-provider";

export const activate = (context: ExtensionContext) => {
	// Register the commands
	context.subscriptions.push(
		commands.registerCommand(
			"kiro-for-codex-ide.showInformation",
			showInformationMessage
		)
	);

	context.subscriptions.push(
		commands.registerCommand(
			"kiro-for-codex-ide.reverseSelection",
			reverseSelection
		)
	);

	// Register the webview providers
	const simpleViewProvider = new SimpleViewProvider(context.extensionUri);
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			SimpleViewProvider.viewId,
			simpleViewProvider
		)
	);

	const promptsExplorerProvider = new PromptsExplorerProvider();
	context.subscriptions.push(
		window.registerTreeDataProvider(
			PromptsExplorerProvider.viewId,
			promptsExplorerProvider
		)
	);

	context.subscriptions.push(
		commands.registerCommand(
			PromptsExplorerProvider.refreshCommandId,
			promptsExplorerProvider.refresh
		)
	);

	context.subscriptions.push(
		commands.registerCommand(
			PromptsExplorerProvider.createPromptCommandId,
			promptsExplorerProvider.createPrompt
		)
	);

	context.subscriptions.push(
		commands.registerCommand(
			PromptsExplorerProvider.runPromptCommandId,
			promptsExplorerProvider.runPrompt
		)
	);
	const interactiveViewProvider = new InteractiveViewProvider(
		context.extensionUri
	);
	context.subscriptions.push(
		window.registerWebviewViewProvider(
			InteractiveViewProvider.viewId,
			interactiveViewProvider
		)
	);
};

// this method is called when your extension is deactivated
// biome-ignore lint/suspicious/noEmptyBlockStatements: ignore
export function deactivate() {}
