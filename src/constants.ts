// VSCode configuration namespace for this extension
export const VSC_CONFIG_NAMESPACE = "kiro-codex-ide";

// Prompts directory is fixed and not user configurable
export const PROMPTS_DIR = ".codex/prompts" as const;

// File names
export const CONFIG_FILE_NAME = "kfc-settings.json";

// Default configuration
export const DEFAULT_CONFIG = {
	paths: {
		specs: ".codex/specs",
		steering: ".codex/steering",
		settings: ".codex/settings",
	},
	views: {
		specs: true,
		steering: true,
		mcp: true,
		hooks: true,
		settings: false,
	},
} as const;

// Legacy exports for backward compatibility (can be removed after updating all references)
export const DEFAULT_PATHS = DEFAULT_CONFIG.paths;
export const DEFAULT_VIEW_VISIBILITY = DEFAULT_CONFIG.views;
