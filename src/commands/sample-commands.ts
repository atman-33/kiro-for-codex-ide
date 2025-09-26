import { window } from "vscode";

/**
 * Shows an information message.
 */
export const showInformationMessage = () => {
	window.showInformationMessage("Hello from vscode-extension-boilerplate!");
};

/**
 * Reverses the text in the current selection.
 */
export const reverseSelection = () => {
	const editor = window.activeTextEditor;
	if (editor) {
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		const reversedText = text.split("").reverse().join("");
		editor.edit((editBuilder) => {
			editBuilder.replace(selection, reversedText);
		});
	}
};
