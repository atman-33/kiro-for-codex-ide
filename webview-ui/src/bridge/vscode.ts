// Minimal wrapper around acquireVsCodeApi with a dev-friendly fallback

type VsCodeApi = {
	postMessage: (message: any) => void;
	getState: () => any;
	setState: (state: any) => void;
};

declare global {
	// biome-ignore lint/nursery/useConsistentTypeDefinitions: ignore
	interface Window {
		acquireVsCodeApi?: () => VsCodeApi;
	}
}

const DEV_ECHO_TIMEOUT_MS = 50;

let vscodeApi: VsCodeApi;
if (
	typeof window !== "undefined" &&
	typeof window.acquireVsCodeApi === "function"
) {
	vscodeApi = window.acquireVsCodeApi!();
} else {
	// Local preview fallback (no-op postMessage)
	vscodeApi = {
		postMessage: (msg: any) => {
			// Simulate echo in dev: bounce back the same message shape
			window.setTimeout(() => {
				window.dispatchEvent(
					new MessageEvent("message", {
						data: {
							type: "codex.chat/echoResult",
							id: msg.id,
							text: msg.text,
							ts: Date.now(),
						},
					})
				);
			}, DEV_ECHO_TIMEOUT_MS);
		},
		getState: () => ({}),
		// In dev mode, state is not persisted
		setState: () => ({}),
	};
}

export const vscode = vscodeApi;
