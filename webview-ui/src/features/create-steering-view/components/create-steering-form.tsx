import { TextareaPanel } from "@/components/textarea-panel";
import { Button } from "@/components/ui/button";
import type { ChangeEvent, FormEvent, MutableRefObject } from "react";
import type {
	CreateSteeringFieldErrors,
	CreateSteeringFormData,
} from "../types";

const SUMMARY_HELPER_ID = "create-steering-summary-helper";

type CreateSteeringFormProps = {
	formData: CreateSteeringFormData;
	fieldErrors: CreateSteeringFieldErrors;
	isSubmitting: boolean;
	autosaveStatus: string;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onCancel: () => void;
	onFieldChange: (
		field: keyof CreateSteeringFormData
	) => (event: ChangeEvent<HTMLTextAreaElement>) => void;
	summaryRef: MutableRefObject<HTMLTextAreaElement | null>;
	audienceRef: MutableRefObject<HTMLTextAreaElement | null>;
	keyPracticesRef: MutableRefObject<HTMLTextAreaElement | null>;
	antiPatternsRef: MutableRefObject<HTMLTextAreaElement | null>;
};

export const CreateSteeringForm = ({
	formData,
	fieldErrors,
	isSubmitting,
	autosaveStatus,
	onSubmit,
	onCancel,
	onFieldChange,
	summaryRef,
	audienceRef,
	keyPracticesRef,
	antiPatternsRef,
}: CreateSteeringFormProps) => (
	<form
		aria-busy={isSubmitting}
		className="flex flex-1 flex-col gap-6"
		noValidate
		onSubmit={onSubmit}
	>
		<section className="flex flex-1 flex-col gap-4">
			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-steering-summary"
				>
					Guidance Summary{" "}
					<span className="text-[color:var(--vscode-errorForeground)]">*</span>
				</label>
				<TextareaPanel
					containerClassName="shadow-[0_16px_32px_rgba(0,0,0,0.25)]"
					disabled={isSubmitting}
					onChange={onFieldChange("summary")}
					placeholder="Describe the core guidance you want agents to follow…"
					rows={4}
					textareaClassName="min-h-[6rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-steering-summary",
						name: "summary",
						"aria-required": true,
						"aria-invalid": fieldErrors.summary ? true : undefined,
						"aria-describedby": fieldErrors.summary
							? SUMMARY_HELPER_ID
							: undefined,
					}}
					textareaRef={summaryRef}
					value={formData.summary}
				>
					{fieldErrors.summary ? (
						<div
							className="flex items-center justify-end px-3 py-2 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs"
							id={SUMMARY_HELPER_ID}
						>
							<span className="text-[color:var(--vscode-errorForeground)]">
								{fieldErrors.summary}
							</span>
						</div>
					) : null}
				</TextareaPanel>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-steering-audience"
				>
					Audience & Ownership
				</label>
				<TextareaPanel
					disabled={isSubmitting}
					onChange={onFieldChange("audience")}
					placeholder="Who should follow this guidance? Include roles, teams, or repos…"
					rows={3}
					textareaClassName="min-h-[5rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-steering-audience",
						name: "audience",
					}}
					textareaRef={audienceRef}
					value={formData.audience}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-steering-key-practices"
				>
					Key Practices to Follow
				</label>
				<TextareaPanel
					disabled={isSubmitting}
					onChange={onFieldChange("keyPractices")}
					placeholder="List the behaviors, patterns, or examples the agent must follow…"
					rows={3}
					textareaClassName="min-h-[5rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-steering-key-practices",
						name: "keyPractices",
					}}
					textareaRef={keyPracticesRef}
					value={formData.keyPractices}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-steering-anti-patterns"
				>
					Pitfalls to Avoid
				</label>
				<TextareaPanel
					disabled={isSubmitting}
					onChange={onFieldChange("antiPatterns")}
					placeholder="Capture anti-patterns, gotchas, or things agents must never do…"
					rows={3}
					textareaClassName="min-h-[5rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-steering-anti-patterns",
						name: "antiPatterns",
					}}
					textareaRef={antiPatternsRef}
					value={formData.antiPatterns}
				/>
			</div>
		</section>

		<footer className="flex flex-col gap-3 border-[color:color-mix(in_srgb,var(--vscode-foreground)_12%,transparent)] border-t pt-4">
			<div className="flex flex-wrap items-center justify-between gap-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs">
				<span>{autosaveStatus}</span>
			</div>
			<div className="flex flex-wrap justify-end gap-3">
				<Button
					disabled={isSubmitting}
					onClick={onCancel}
					type="button"
					variant="secondary"
				>
					Cancel
				</Button>
				<Button disabled={isSubmitting} type="submit" variant="default">
					{isSubmitting ? "Creating…" : "Create Steering"}
				</Button>
			</div>
		</footer>
	</form>
);
