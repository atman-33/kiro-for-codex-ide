import type { TextDocumentShowOptions } from "vscode";
import { Uri, ViewColumn, window, workspace } from "vscode";
import { addDocumentToCodexChat } from "./codex-chat-utils";

const CHAT_TMP_FOLDER = [".codex", "tmp", "chat"] as const;
const RANDOM_STRING_RADIX = 36;
const RANDOM_STRING_LENGTH = 6;

type SendPromptOptions = {
	showOptions?: TextDocumentShowOptions;
};

const defaultShowOptions: TextDocumentShowOptions = {
	preview: false,
	viewColumn: ViewColumn.Active,
};

const createChatTempFile = async (content: string): Promise<Uri> => {
	const workspaceFolder = workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error("Workspace folder is required to send prompts to chat.");
	}

	const tempDir = Uri.joinPath(workspaceFolder.uri, ...CHAT_TMP_FOLDER);
	await workspace.fs.createDirectory(tempDir);

	const randomSuffix = Math.random()
		.toString(RANDOM_STRING_RADIX)
		.slice(2, 2 + RANDOM_STRING_LENGTH);
	const fileName = `prompt-${Date.now()}-${randomSuffix}.md`;
	const fileUri = Uri.joinPath(tempDir, fileName);

	await workspace.fs.writeFile(fileUri, Buffer.from(content, "utf8"));

	return fileUri;
};

export const sendPromptToChat = async (
	prompt: string,
	options?: SendPromptOptions
): Promise<void> => {
	const fileUri = await createChatTempFile(prompt);
	const document = await workspace.openTextDocument(fileUri);
	const showOptions = options?.showOptions ?? defaultShowOptions;
	await window.showTextDocument(document, showOptions);
	await addDocumentToCodexChat(fileUri, showOptions);
};
