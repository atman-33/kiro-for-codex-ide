import { join } from "path";
import { Uri, type WorkspaceFolder, workspace } from "vscode";
import {
	CONFIG_FILE_NAME,
	DEFAULT_PATHS,
	DEFAULT_VIEW_VISIBILITY,
} from "../constants";

export type KiroCodexIdeSettings = {
	paths: {
		specs: string;
		steering: string;
		settings: string;
	};
	views: {
		specs: { visible: boolean };
		steering: { visible: boolean };
		prompts: { visible: boolean };
		settings: { visible: boolean };
	};
};

export class ConfigManager {
	private static instance: ConfigManager;
	private settings: KiroCodexIdeSettings | null = null;
	private readonly workspaceFolder: WorkspaceFolder | undefined;

	// Internal constants
	private static readonly TERMINAL_VENV_ACTIVATION_DELAY = 800; // ms

	private constructor() {
		this.workspaceFolder = workspace.workspaceFolders?.[0];
	}

	static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}
		return ConfigManager.instance;
	}

	async loadSettings(): Promise<KiroCodexIdeSettings> {
		if (!this.workspaceFolder) {
			return this.getDefaultSettings();
		}

		const settingsPath = join(
			this.workspaceFolder.uri.fsPath,
			DEFAULT_PATHS.settings,
			CONFIG_FILE_NAME
		);

		try {
			const fileContent = await workspace.fs.readFile(Uri.file(settingsPath));
			const settings = JSON.parse(Buffer.from(fileContent).toString());
			const mergedSettings = { ...this.getDefaultSettings(), ...settings };
			this.settings = mergedSettings;
			return this.settings!;
		} catch (error) {
			// Return default settings if file doesn't exist
			this.settings = this.getDefaultSettings();
			return this.settings!;
		}
	}

	getSettings(): KiroCodexIdeSettings {
		if (!this.settings) {
			this.settings = this.getDefaultSettings();
		}
		return this.settings;
	}

	getPath(type: keyof typeof DEFAULT_PATHS): string {
		const settings = this.getSettings();
		return settings.paths[type] || DEFAULT_PATHS[type];
	}

	getAbsolutePath(type: keyof typeof DEFAULT_PATHS): string {
		if (!this.workspaceFolder) {
			throw new Error("No workspace folder found");
		}
		return join(this.workspaceFolder.uri.fsPath, this.getPath(type));
	}

	getTerminalDelay(): number {
		return ConfigManager.TERMINAL_VENV_ACTIVATION_DELAY;
	}

	private getDefaultSettings(): KiroCodexIdeSettings {
		return {
			paths: { ...DEFAULT_PATHS },
			views: {
				specs: { visible: DEFAULT_VIEW_VISIBILITY.specs },
				steering: { visible: DEFAULT_VIEW_VISIBILITY.steering },
				prompts: { visible: DEFAULT_VIEW_VISIBILITY.prompts },
				settings: { visible: DEFAULT_VIEW_VISIBILITY.settings },
			},
		};
	}

	async saveSettings(settings: KiroCodexIdeSettings): Promise<void> {
		if (!this.workspaceFolder) {
			throw new Error("No workspace folder found");
		}

		const settingsDir = join(
			this.workspaceFolder.uri.fsPath,
			DEFAULT_PATHS.settings
		);
		const settingsPath = join(settingsDir, CONFIG_FILE_NAME);

		// Ensure directory exists
		await workspace.fs.createDirectory(Uri.file(settingsDir));

		// Save settings
		await workspace.fs.writeFile(
			Uri.file(settingsPath),
			Buffer.from(JSON.stringify(settings, null, 2))
		);

		this.settings = settings;
	}
}
