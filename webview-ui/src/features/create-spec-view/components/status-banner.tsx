import type { ReactNode } from "react";

export type StatusTone = "info" | "warning" | "error";

export type StatusBannerProps = {
	children: ReactNode;
	tone: StatusTone;
	role: "status" | "alert";
	ariaLive?: "polite" | "assertive";
};

const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
	info: "border-[color:color-mix(in_srgb,var(--vscode-foreground)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] text-[color:var(--vscode-foreground)]",
	warning:
		"border-[color:color-mix(in_srgb,var(--vscode-warningForeground)_50%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-warningForeground)_12%,transparent)] text-[color:var(--vscode-warningForeground)]",
	error:
		"border-[color:var(--vscode-errorForeground)] bg-[color:color-mix(in_srgb,var(--vscode-errorForeground)_12%,transparent)] text-[color:var(--vscode-errorForeground)]",
};

export const StatusBanner = ({
	children,
	tone,
	role,
	ariaLive = "polite",
}: StatusBannerProps) => (
	<div
		aria-live={ariaLive}
		className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${STATUS_TONE_CLASSES[tone]}`}
		role={role}
	>
		{children}
	</div>
);
