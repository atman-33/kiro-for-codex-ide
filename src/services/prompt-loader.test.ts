import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptLoader } from "./prompt-loader";

// Mock the prompts module
vi.mock("../prompts/target", () => ({
	spec: {
		frontmatter: {
			id: "spec-create-spec",
			name: "Create Spec",
			version: "0.1.0",
			description: "Creates a new specification file.",
			variables: {
				feature: { required: true },
			},
		},
		content: "Feature: {{feature}}",
	},
}));

describe("PromptLoader", () => {
	let loader: PromptLoader;

	beforeEach(() => {
		// Force a new instance for each test and initialize it
		// biome-ignore lint/complexity/useLiteralKeys: ignore
		PromptLoader["instance"] = new (PromptLoader as any)();
		loader = PromptLoader.getInstance();
		loader.initialize();
	});

	// 1. Happy Path: Test that renderPrompt correctly renders a prompt.
	it("should render a prompt with the given variables", () => {
		const rendered = loader.renderPrompt("spec-create-spec", {
			feature: "New Login Flow",
		});
		expect(rendered).toBe("Feature: New Login Flow");
	});

	// 2. Edge Case: Test that renderPrompt throws an error for missing required variables.
	it("should throw an error if a required variable is missing", () => {
		expect(() => loader.renderPrompt("spec-create-spec", {})).toThrow(
			"Variable validation failed: Missing required variable: feature"
		);
	});

	// 3. Fail Safe / Mocks: Test that loadPrompt throws an error for a non-existent prompt.
	it("should throw an error when trying to load a non-existent prompt", () => {
		const promptId = "non-existent-prompt";
		expect(() => loader.loadPrompt(promptId)).toThrow(
			`Prompt not found: ${promptId}. Available prompts: spec-create-spec`
		);
	});
});
