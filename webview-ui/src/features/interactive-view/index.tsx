import { vscode } from "@/bridge/vscode";
import { PillButton } from "@/components/pill-button";
import { TextareaPanel } from "@/components/textarea-panel";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent,
} from "react";

export const InteractiveView = () => {
	const [message, setMessage] = useState("");
	const [response, setResponse] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSendMessage = useCallback(() => {
		const trimmed = message.trim();
		if (!trimmed) {
			return;
		}

		vscode.postMessage({
			command: "interactive-view.sendMessage",
			text: trimmed,
		});
	}, [message]);

	const handleComposerKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				handleSendMessage();
			}
		},
		[handleSendMessage]
	);

	const handleClearMessage = useCallback(() => {
		setMessage("");
		textareaRef.current?.focus();
	}, []);

	useEffect(() => {
		const listener = (event: MessageEvent) => {
			const payload = event.data;
			if (payload?.command === "interactive-view.showMessage") {
				setResponse(payload.text ?? "");
			}
		};

		window.addEventListener("message", listener);

		return () => {
			window.removeEventListener("message", listener);
		};
	}, []);

	const isMessageEmpty = message.trim().length === 0;
	const hasResponse = response.trim().length > 0;

	return (
		<div className="mx-auto flex h-full max-w-3xl flex-col gap-5 px-3 py-0.5">
			<header className="flex flex-col gap-2">
				<h1 className="font-semibold text-[color:var(--vscode-foreground)] text-xl leading-tight">
					Interactive Playground
				</h1>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
					Compose a request for the extension and review the response below.
				</p>
			</header>

			<TextareaPanel
				containerClassName="px-2 shadow-[0_16px_32px_rgba(0,0,0,0.25)]"
				onChange={(event) => setMessage(event.target.value)}
				onKeyDown={handleComposerKeyDown}
				placeholder="Send a message to the extension..."
				rows={5}
				textareaClassName="min-h-[6rem] text-sm leading-6"
				textareaRef={textareaRef}
				value={message}
			>
				<div className="flex flex-wrap items-center justify-between gap-3 p-2">
					<span className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
						Press ⌘⏎ / Ctrl+Enter to send
					</span>
					<div className="flex items-center gap-2">
						<PillButton
							className="text-[color:var(--vscode-descriptionForeground,#9ca3af)]"
							disabled={isMessageEmpty}
							onClick={handleClearMessage}
						>
							Clear
						</PillButton>
						<PillButton
							className="bg-[color:var(--vscode-button-background,#7c3aed)] text-[color:var(--vscode-button-foreground,#ffffff)] hover:bg-[color:var(--vscode-button-hover-background,var(--vscode-button-background,#7c3aed)))]"
							disabled={isMessageEmpty}
							onClick={handleSendMessage}
						>
							Send
						</PillButton>
					</div>
				</div>
			</TextareaPanel>

			<section className="flex min-h-[10rem] flex-col gap-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-editor-background)_70%,transparent)] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-medium text-[color:var(--vscode-foreground)] text-base">
						Latest response
					</h2>
					{hasResponse && (
						<PillButton onClick={() => setResponse("")}>
							Clear response
						</PillButton>
					)}
				</div>
				<div
					className={
						"whitespace-pre-wrap text-sm leading-relaxed" +
						(hasResponse
							? "text-[color:var(--vscode-foreground)]"
							: "text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] italic")
					}
				>
					{hasResponse
						? response
						: "Responses from the extension will show up here once available."}
				</div>
			</section>
		</div>
	);
};
