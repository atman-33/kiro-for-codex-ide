import { TextareaPanel } from "@/components/textarea-panel";
import { Button } from "@/components/ui/button";
import type { ChangeEvent, FormEvent, MutableRefObject } from "react";
import type { CreateSpecFieldErrors, CreateSpecFormData } from "../types";

const SUMMARY_HELPER_ID = "create-spec-summary-helper";

type CreateSpecFormProps = {
	formData: CreateSpecFormData;
	fieldErrors: CreateSpecFieldErrors;
	isSubmitting: boolean;
	autosaveStatus: string;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onCancel: () => void;
	onFieldChange: (
		field: keyof CreateSpecFormData
	) => (event: ChangeEvent<HTMLTextAreaElement>) => void;
	summaryRef: MutableRefObject<HTMLTextAreaElement | null>;
	productContextRef: MutableRefObject<HTMLTextAreaElement | null>;
	technicalConstraintsRef: MutableRefObject<HTMLTextAreaElement | null>;
	openQuestionsRef: MutableRefObject<HTMLTextAreaElement | null>;
};

export const CreateSpecForm = ({
	formData,
	fieldErrors,
	isSubmitting,
	autosaveStatus,
	onSubmit,
	onCancel,
	onFieldChange,
	summaryRef,
	productContextRef,
	technicalConstraintsRef,
	openQuestionsRef,
}: CreateSpecFormProps) => (
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
					htmlFor="create-spec-summary"
				>
					Summary{" "}
					<span className="text-[color:var(--vscode-errorForeground)]">*</span>
				</label>
				<TextareaPanel
					containerClassName="shadow-[0_16px_32px_rgba(0,0,0,0.25)]"
					disabled={isSubmitting}
					onChange={onFieldChange("summary")}
					placeholder="Capture the key outcome you want to achieve…"
					rows={4}
					textareaClassName="min-h-[6rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-spec-summary",
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
					htmlFor="create-spec-product-context"
				>
					Product Context
				</label>
				<TextareaPanel
					disabled={isSubmitting}
					onChange={onFieldChange("productContext")}
					placeholder="Describe current product state, users, or constraints…"
					rows={3}
					textareaClassName="min-h-[5rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-spec-product-context",
						name: "productContext",
					}}
					textareaRef={productContextRef}
					value={formData.productContext}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-spec-technical-constraints"
				>
					Technical Constraints
				</label>
				<TextareaPanel
					disabled={isSubmitting}
					onChange={onFieldChange("technicalConstraints")}
					placeholder="List architecture decisions, deadlines, or compliance needs…"
					rows={3}
					textareaClassName="min-h-[5rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-spec-technical-constraints",
						name: "technicalConstraints",
					}}
					textareaRef={technicalConstraintsRef}
					value={formData.technicalConstraints}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label
					className="font-medium text-[color:var(--vscode-foreground)] text-sm"
					htmlFor="create-spec-open-questions"
				>
					Open Questions
				</label>
				<TextareaPanel
					disabled={isSubmitting}
					onChange={onFieldChange("openQuestions")}
					placeholder="Capture unknowns, dependencies, or risks to explore…"
					rows={3}
					textareaClassName="min-h-[5rem] max-h-[60vh] overflow-y-auto text-sm leading-6"
					textareaProps={{
						id: "create-spec-open-questions",
						name: "openQuestions",
					}}
					textareaRef={openQuestionsRef}
					value={formData.openQuestions}
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
					{isSubmitting ? "Creating…" : "Create Spec"}
				</Button>
			</div>
		</footer>
	</form>
);
