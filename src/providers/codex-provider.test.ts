/** biome-ignore-all lint/style/noMagicNumbers: ignore */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { window, workspace } from "vscode";
import { CodexProvider } from "./codex-provider";

// Mock dependencies for fs/promises
vi.mock("fs", () => ({
	promises: {
		writeFile: vi.fn().mockResolvedValue(undefined),
		unlink: vi.fn().mockResolvedValue(undefined),
	},
}));

describe("CodexProvider", () => {
	let codexProvider: CodexProvider;
	const mockContext = {
		globalStorageUri: { fsPath: "/fake/storage" },
	} as any;
	const mockOutputChannel = { appendLine: vi.fn() } as any;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		// ✅ Ensure workspace.fs.createDirectory resolves
		vi.spyOn(workspace.fs, "createDirectory").mockResolvedValueOnce(
			undefined as any
		);

		codexProvider = new CodexProvider(mockContext, mockOutputChannel);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	// 1) Happy Path: shell integration available
	it("should execute command with shell integration when available", async () => {
		// Terminal with shellIntegration
		const mockTerminal = {
			shellIntegration: { executeCommand: vi.fn() },
			dispose: vi.fn(),
		} as any;

		// Mock terminal creation
		vi.spyOn(window, "createTerminal").mockReturnValue(mockTerminal);

		// Keep identity stable for 'execution'
		const mockExecution = { id: "exec-1" };
		mockTerminal.shellIntegration.executeCommand.mockReturnValue(mockExecution);

		// Mock onDidEnd... and fire asynchronously AFTER registration
		vi.spyOn(window, "onDidEndTerminalShellExecution").mockImplementation(
			(listener: any) => {
				// Schedule asynchronously so 'disposable' is initialized before callback runs
				setTimeout(() => {
					listener({
						terminal: mockTerminal,
						execution: mockExecution,
						exitCode: 0,
					});
				}, 0);
				return { dispose: vi.fn() } as any;
			}
		);

		const resultPromise = codexProvider.invokeCodexHeadless("test prompt");

		// Kick the 100ms polling interval to detect shellIntegration
		await vi.advanceTimersByTimeAsync(100);

		// Flush the scheduled setTimeout(0) above reliably
		await vi.runOnlyPendingTimersAsync();

		const result = await resultPromise;

		expect(result.exitCode).toBe(0);
		expect(mockTerminal.shellIntegration.executeCommand).toHaveBeenCalledTimes(
			1
		);
	});

	// 2) Fallback path: no shell integration
	it("should use fallback mode when shell integration is not available", async () => {
		const mockTerminal = {
			sendText: vi.fn(),
			dispose: vi.fn(),
		} as any;

		vi.spyOn(window, "createTerminal").mockReturnValue(mockTerminal);

		const promise = codexProvider.invokeCodexHeadless("test prompt");

		// After 20 checks x 100ms => it falls back (>2000ms)
		await vi.advanceTimersByTimeAsync(2100);

		// Fallback resolves after 5000ms timeout
		await vi.advanceTimersByTimeAsync(5000);

		const result = await promise;

		expect(result.exitCode).toBeUndefined();
		expect(mockTerminal.sendText).toHaveBeenCalledTimes(1);
	});

	// 3) WSL path conversion
	it("should convert a Windows path to a WSL path on win32 platform", () => {
		// Mock process.platform via getter spy
		vi.spyOn(process, "platform", "get").mockReturnValue(
			"win32" as NodeJS.Platform
		);

		const windowsPath = "C:\\Users\\Test\\file.txt";
		const expectedWslPath = "/mnt/c/Users/Test/file.txt";
		const wslPath = (codexProvider as any).convertPathIfWsl({
			filePath: windowsPath,
		});

		expect(wslPath).toBe(expectedWslPath);
	});
});
