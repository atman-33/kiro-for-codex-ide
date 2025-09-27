import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NotificationUtils } from "./notification-utils";
import { window, ProgressLocation } from "vscode";

describe("NotificationUtils", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// 1. Happy Path: Test that showInfo calls window.showInformationMessage.
	it("should call showInformationMessage with the correct message", () => {
		const message = "Info message";
		NotificationUtils.showInfo(message);
		expect(window.showInformationMessage).toHaveBeenCalledWith(message);
	});

	// 2. Edge Case: Test showAutoDismissNotification with a custom duration.
	it("should call withProgress and wait for the specified duration", async () => {
		const message = "Auto-dismiss message";
		const durationMs = 5000;

		const withProgressPromise = NotificationUtils.showAutoDismissNotification(
			message,
			durationMs
		);

		// Check that withProgress was called correctly
		expect(window.withProgress).toHaveBeenCalledWith(
			{
				location: ProgressLocation.Notification,
				title: message,
				cancellable: false,
			},
			expect.any(Function)
		);

		// Manually advance timers to resolve the promise inside withProgress
		await vi.advanceTimersByTimeAsync(durationMs);
		await withProgressPromise;
	});

	// 3. Fail Safe / Mocks: Test that showError calls window.showErrorMessage.
	it("should call showErrorMessage with the correct message", () => {
		const message = "Error message";
		NotificationUtils.showError(message);
		expect(window.showErrorMessage).toHaveBeenCalledWith(message);
	});
});
