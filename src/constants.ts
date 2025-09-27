// VSCode configuration namespace for this extension
export const VSC_CONFIG_NAMESPACE = "kiro-codex-ide";

// Default configuration
export const DEFAULT_CONFIG = {
	paths: {
		prompts: ".codex/prompts",
		specs: ".codex/specs",
		steering: ".codex/steering",
	},
	views: {
		specs: true,
		steering: true,
		prompts: true,
		settings: false,
	},
} as const;

// Legacy exports for backward compatibility (can be removed after updating all references)
export const DEFAULT_PATHS = DEFAULT_CONFIG.paths;
export const DEFAULT_VIEW_VISIBILITY = DEFAULT_CONFIG.views;
