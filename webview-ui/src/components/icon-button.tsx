import type React from "react";

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	/** Extra Tailwind classes to append */
	className?: string;
	/** Inline style override/merge */
	style?: React.CSSProperties;
	/** Accessible label for screen readers */
	"aria-label"?: string;
	children: React.ReactNode;
};

/**
 * Small circular icon button with VS Code themed colors.
 * Defaults match existing chat composer buttons.
 */
export function IconButton({
	className,
	style,
	type,
	children,
	...rest
}: IconButtonProps) {
	return (
		<button
			className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full ${className ?? ""}`}
			style={{
				backgroundColor:
					"color-mix(in srgb, var(--vscode-foreground) 50%, transparent)",
				color: "var(--vscode-sideBar-background)",
				...(style ?? {}),
			}}
			type={type ?? "button"}
			{...rest}
		>
			{children}
		</button>
	);
}
