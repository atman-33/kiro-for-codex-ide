import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "vscode";
import { FileType, Uri, workspace } from "vscode";
import { PromptsExplorerProvider } from "./prompts-explorer-provider";
import { ConfigManager } from "../utils/config-manager";

vi.mock("os", () => ({
	homedir: vi.fn(() => "/home/test"),
}));

describe("PromptsExplorerProvider", () => {
	let provider: PromptsExplorerProvider;
	const context = {
		extensionUri: Uri.file("/fake/extension"),
	} as ExtensionContext;
	const projectRoot = "/fake/workspace/.codex/prompts";
	const globalRoot = "/home/test/.codex/prompts";

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset ConfigManager singleton between tests
		// biome-ignore lint/complexity/useLiteralKeys: accessing private test helper
		(ConfigManager as any)["instance"] = undefined;
		// Provide deterministic relative path handling for prompt descriptions
		(workspace as any).asRelativePath = vi.fn((uri: { fsPath: string }) =>
			uri.fsPath.startsWith(`${projectRoot}/`)
				? uri.fsPath.replace(`${projectRoot}/`, "")
				: uri.fsPath
		);
		vi.mocked(workspace.fs.readDirectory).mockReset();
		vi.mocked(workspace.fs.readDirectory).mockResolvedValue([] as any);

		provider = new PromptsExplorerProvider(context);
	});

	it("returns project and global groups at the root", async () => {
		const rootItems = await provider.getChildren();
		expect(rootItems).toHaveLength(2);
		const [projectGroup, globalGroup] = rootItems;

		expect(projectGroup.label).toBe("Project");
		expect(projectGroup.contextValue).toBe("prompt-group-project");
		expect(projectGroup.description).toBe(".codex/prompts");

		expect(globalGroup.label).toBe("Global");
		expect(globalGroup.contextValue).toBe("prompt-group-global");
		expect(globalGroup.description).toBe(globalRoot);
	});

	it("lists project prompts within the project group", async () => {
		vi.mocked(workspace.fs.readDirectory).mockImplementation((uri) => {
			if (uri.fsPath === projectRoot) {
				return Promise.resolve([
					["alpha.md", FileType.File],
					["nested", FileType.Directory],
				] as any);
			}
			if (uri.fsPath === `${projectRoot}/nested`) {
				return Promise.resolve([["beta.md", FileType.File]] as any);
			}
			return Promise.resolve([] as any);
		});

		const [projectGroup] = await provider.getChildren();
		const projectPrompts = await provider.getChildren(projectGroup);

		expect(projectPrompts.map((item) => item.label)).toEqual([
			"alpha.md",
			"beta.md",
		]);
		expect(projectPrompts.every((item) => item.contextValue === "prompt")).toBe(
			true
		);
		expect(projectPrompts.every((item) => item.source === "project")).toBe(
			true
		);
	});

	it("shows an empty state when the global directory is missing", async () => {
		vi.mocked(workspace.fs.readDirectory).mockImplementation((uri) => {
			if (uri.fsPath.startsWith(globalRoot)) {
				return Promise.reject(new Error("missing"));
			}
			return Promise.resolve([] as any);
		});

		const [, globalGroup] = await provider.getChildren();
		const globalPrompts = await provider.getChildren(globalGroup);

		expect(globalPrompts).toHaveLength(1);
		expect(globalPrompts[0].label).toBe("No prompts found");
		expect(globalPrompts[0].contextValue).toBe("prompts-empty");
	});
});
