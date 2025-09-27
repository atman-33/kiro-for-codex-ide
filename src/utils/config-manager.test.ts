import { beforeEach, describe, expect, it, vi } from "vitest";
import { workspace } from "vscode";
import { DEFAULT_PATHS, DEFAULT_VIEW_VISIBILITY } from "../constants";
import { ConfigManager } from "./config-manager";

describe("ConfigManager", () => {
	let configManager: ConfigManager;

	beforeEach(() => {
		// Reset mocks before each test
		vi.mocked(workspace.getConfiguration).mockReturnValue({
			get: vi.fn(),
		} as any);
		// Force getInstance to return a new instance for each test
		// biome-ignore lint/complexity/useLiteralKeys: ignore
		ConfigManager["instance"] = new (ConfigManager as any)();
		configManager = ConfigManager.getInstance();
	});

	// 1. Happy Path: Test that getInstance() returns a singleton instance.
	it("should return a singleton instance", () => {
		const instance1 = ConfigManager.getInstance();
		const instance2 = ConfigManager.getInstance();
		expect(instance1).toBe(instance2);
	});

	// 2. Edge Case: Test getAbsolutePath() when there is no workspace folder.
	it("should throw an error when getting absolute path without a workspace folder", () => {
		vi.spyOn(workspace, "workspaceFolders", "get").mockReturnValue(undefined);
		// Force a new instance without a workspace folder
		// biome-ignore lint/complexity/useLiteralKeys: ignore
		ConfigManager["instance"] = new (ConfigManager as any)();
		configManager = ConfigManager.getInstance();
		expect(() => configManager.getAbsolutePath("specs")).toThrow(
			"No workspace folder found"
		);
	});

	// 3. Fail Safe / Mocks: Test that getSettings() returns the default settings.
	it("should return default settings when no settings are loaded", () => {
		const settings = configManager.getSettings();
		expect(settings).toEqual({
			paths: DEFAULT_PATHS,
			views: {
				specs: { visible: DEFAULT_VIEW_VISIBILITY.specs },
				steering: { visible: DEFAULT_VIEW_VISIBILITY.steering },
				prompts: { visible: DEFAULT_VIEW_VISIBILITY.prompts },
				settings: { visible: DEFAULT_VIEW_VISIBILITY.settings },
			},
		});
	});
});
