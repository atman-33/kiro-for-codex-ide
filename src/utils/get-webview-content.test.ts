/** biome-ignore-all lint/performance/useTopLevelRegex: ignore */
import { describe, expect, it, vi } from "vitest";
import type { Webview } from "vscode";
import { Uri } from "vscode";
import { getWebviewContent } from "./get-webview-content";

const mockWebview = {
	asWebviewUri: vi.fn((uri) => `file://${uri.fsPath}`),
	cspSource: "https://example.com",
} as unknown as Webview;

const mockExtensionUri = Uri.parse("file:///mock/extension");

describe("get-webview-content", () => {
	// 1. Happy Path: Test that getWebviewContent returns a valid HTML string.
	it("should return a valid HTML string with correct URIs and page name", () => {
		const page = "test-page";
		const html = getWebviewContent(mockWebview, mockExtensionUri, page);

		expect(html).toContain('<div id="root" data-page="test-page"></div>');
		expect(html).toContain(
			'src="file:///mock/extension/dist/webview/app/index.js"'
		);
		expect(html).toContain(
			'href="file:///mock/extension/dist/webview/app/assets/index.css"'
		);
		expect(html).toContain("<title>Kiro for Codex IDE</title>");
	});

	// 2. Edge Case: Test getNonce function for correct length and format.
	it("should generate a nonce of 32 characters", () => {
		// This test is a bit tricky since getNonce is not exported.
		// We'll test its effect on the output of getWebviewContent.
		const html = getWebviewContent(mockWebview, mockExtensionUri, "test");
		const nonceMatch = html.match(/script-src 'nonce-([a-zA-Z0-9]{32})'/);
		expect(nonceMatch).not.toBeNull();
		// biome-ignore lint/style/noMagicNumbers: ignore
		expect(nonceMatch?.[1].length).toBe(32);
	});

	// 3. Fail Safe / Mocks: Test that the CSP meta tag is correctly formatted.
	it("should correctly format the Content-Security-Policy meta tag", () => {
		const html = getWebviewContent(mockWebview, mockExtensionUri, "test");
		const cspMatch = html.match(
			/<meta http-equiv="Content-Security-Policy" content="(.*)">/
		);
		expect(cspMatch).not.toBeNull();
		const cspContent = cspMatch?.[1] ?? "";
		expect(cspContent).toContain(`default-src 'none'`);
		expect(cspContent).toContain(`img-src ${mockWebview.cspSource} data:`);
		expect(cspContent).toContain(`style-src ${mockWebview.cspSource}`);
		const nonceMatch = cspContent.match(/script-src 'nonce-([a-zA-Z0-9]{32})'/);
		expect(nonceMatch).not.toBeNull();
	});
});
