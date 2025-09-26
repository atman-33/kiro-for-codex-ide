import type React from "react";

export type PillButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	className?: string;
	style?: React.CSSProperties;
	children: React.ReactNode;
};

/**
 * Reusable pill-shaped action button used in headers and toolbars.
 * Consumers provide the inner content (icon/label) via `children`.
 */
export function PillButton({
	className,
	style,
	type,
	children,
	...rest
}: PillButtonProps) {
	return (
		<button
			className={[
				"inline-flex select-none items-center gap-1 rounded-full border-[1px] px-3 py-1.5 text-xs transition-colors",
				"hover:bg-[color:var(--vscode-button-background,#7c3aed)]/10",
				"cursor-pointer focus-visible:outline-none focus-visible:ring-1",
				className ?? "",
			].join(" ")}
			style={{
				borderColor:
					"color-mix(in srgb, var(--vscode-foreground) 10%, transparent)",
				color: "var(--vscode-textLink-foreground)",
				...(style ?? {}),
			}}
			type={type ?? "button"}
			{...rest}
		>
			{children}
		</button>
	);
}
