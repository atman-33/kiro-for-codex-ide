import { useLayoutEffect, useRef } from "react";
import type React from "react";

type TextareaPanelProps = {
	value: string;
	onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
	onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
	placeholder?: string;
	disabled?: boolean;
	rows?: number;
	textareaRef?: React.Ref<HTMLTextAreaElement>;
	textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
	/** Additional classes for the textarea element */
	textareaClassName?: string;
	/** Additional classes for the container */
	containerClassName?: string;
	/** Optional inline style for container */
	containerStyle?: React.CSSProperties;
	children?: React.ReactNode;
};

/**
 * Reusable panel with VS Code themed container and a textarea on top.
 * Bottom content (e.g., action buttons) is provided via `children`.
 */
export function TextareaPanel({
	value,
	onChange,
	onKeyDown,
	placeholder,
	disabled,
	rows = 1,
	textareaRef,
	textareaProps,
	textareaClassName,
	containerClassName,
	containerStyle,
	children,
}: TextareaPanelProps) {
	const textareaInternalRef = useRef<HTMLTextAreaElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: ignore
	useLayoutEffect(() => {
		const node = textareaInternalRef.current;
		if (!node) {
			return;
		}

		node.style.height = "auto";
		node.style.height = `${node.scrollHeight}px`;
	}, [value]);

	const assignTextareaRef = (node: HTMLTextAreaElement | null) => {
		textareaInternalRef.current = node;

		if (!textareaRef) {
			return;
		}

		if (typeof textareaRef === "function") {
			textareaRef(node);
			return;
		}

		if (typeof textareaRef === "object") {
			(
				textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>
			).current = node;
		}
	};

	return (
		<div
			className={
				"box-border flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl border bg-[var(--vscode-dropdown-background)] pt-4 pb-2" +
				(containerClassName ?? "")
			}
			style={{
				borderColor:
					"color-mix(in srgb, var(--vscode-foreground) 10%, transparent)",
				...(containerStyle ?? {}),
			}}
		>
			<div className="h-full min-w-0 flex-1">
				<textarea
					className={
						"w-full resize-none overflow-x-hidden bg-transparent px-3 text-[color:var(--vscode-foreground)] outline-none ring-0 placeholder:text-[color:var(--vscode-input-placeholderForeground,#888)]" +
						(textareaClassName ?? "")
					}
					disabled={!!disabled}
					onChange={onChange}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					ref={assignTextareaRef}
					rows={rows}
					{...(textareaProps ?? {})}
					value={value}
				/>
			</div>
			{children}
		</div>
	);
}
