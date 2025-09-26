import { type ExtensionContext, commands, window } from "vscode";
import {
	reverseSelection,
	showInformationMessage,
} from "./commands/sample-commands";
import { InteractiveViewProvider } from "./providers/interactive-view-provider";
import { SimpleViewProvider } from "./providers/simple-view-provider";

export const activate = (context: ExtensionContext) => {
	// Register the commands
	context.subscriptions.push(
		commands.registerCommand(
			"vscode-extension-boilerplate.showInformation",
			showInformationMessage
		)
	);

	context.subscriptions.push(
		commands.registerCommand(
			"vscode-extension-boilerplate.reverseSelection",
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
