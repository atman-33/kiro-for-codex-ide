/**
 * Type definitions for the prompt system
 */

export type PromptVariable = {
	type: "string" | "number" | "boolean" | "array" | "object";
	required?: boolean;
	default?: any;
	description?: string;
};

export type PromptFrontmatter = {
	id: string;
	name: string;
	version: string;
	description?: string;
	author?: string;
	tags?: string[];
	extends?: string;
	variables?: Record<string, PromptVariable>;
};

export type PromptTemplate = {
	frontmatter: PromptFrontmatter;
	content: string;
};

export type PromptMetadata = {
	id: string;
	name: string;
	version: string;
	description?: string;
	category: string;
};

export type ValidationResult = {
	valid: boolean;
	errors?: string[];
};
