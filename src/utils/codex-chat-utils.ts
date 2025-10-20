import {
	commands,
	Position,
	Range,
	Selection,
	TextEditorRevealType,
	window,
	workspace,
	type TextDocumentShowOptions,
	type Uri,
} from "vscode";

const CODEX_ADD_TO_CHAT_COMMAND_ID = "chatgpt.addToThread";

const selectEntireDocument = async (
	documentUri: Uri,
	showOptions: TextDocumentShowOptions = { preview: false }
) => {
	const targetUriString = documentUri.toString();
	let editor = window.activeTextEditor;
	const matchesTarget = (candidate?: typeof editor) =>
		candidate?.document.uri.toString() === targetUriString;

	if (!matchesTarget(editor)) {
		editor = window.visibleTextEditors.find((item) => matchesTarget(item));
	}

	if (!editor) {
		const document = await workspace.openTextDocument(documentUri);
		editor = await window.showTextDocument(document, showOptions);
	} else if (!matchesTarget(window.activeTextEditor)) {
		await window.showTextDocument(editor.document, showOptions);
	}

	const document = editor.document;
	const lastLineIndex = Math.max(document.lineCount - 1, 0);
	const endPosition = document.lineAt(lastLineIndex).range.end;
	const fullRange = new Range(new Position(0, 0), endPosition);

	editor.selection = new Selection(fullRange.start, fullRange.end);
	editor.revealRange(fullRange, TextEditorRevealType.Default);
};

export const addDocumentToCodexChat = async (
	documentUri: Uri,
	showOptions?: TextDocumentShowOptions
): Promise<void> => {
	await selectEntireDocument(documentUri, showOptions);
	await commands.executeCommand(CODEX_ADD_TO_CHAT_COMMAND_ID);
};
