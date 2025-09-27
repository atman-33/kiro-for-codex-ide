import type {
	CancellationToken,
	Uri,
	WebviewView,
	WebviewViewProvider,
	WebviewViewResolveContext,
} from "vscode";
import { getWebviewContent } from "../utils/get-webview-content";

export class SimpleViewProvider implements WebviewViewProvider {
	static readonly viewId = "kiro-for-codex-ide.simpleView";

	private _view?: WebviewView;
	private readonly _extensionUri: Uri;

	constructor(extensionUri: Uri) {
		this._extensionUri = extensionUri;
	}

	resolveWebviewView(
		webviewView: WebviewView,
		context: WebviewViewResolveContext,
		_token: CancellationToken
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		webviewView.webview.html = getWebviewContent(
			webviewView.webview,
			this._extensionUri,
			"simple"
		);
	}
}
