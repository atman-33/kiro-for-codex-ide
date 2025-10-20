import { vscode } from "@/bridge/vscode";
import { TextareaPanel } from "@/components/textarea-panel";
import { Button } from "@/components/ui/button";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type FormEvent,
} from "react";

type CreateSpecFormData = {
	summary: string;
	productContext: string;
	technicalConstraints: string;
	openQuestions: string;
};

type CreateSpecDraftState = {
	formData: CreateSpecFormData;
	lastUpdated: number;
};

type CreateSpecInitPayload = {
	shouldFocusPrimaryField: boolean;
	draft?: CreateSpecDraftState;
};

type CreateSpecExtensionMessage =
	| { type: "create-spec/init"; payload: CreateSpecInitPayload }
	| { type: "create-spec/submit:success" }
	| { type: "create-spec/submit:error"; payload: { message: string } }
	| { type: "create-spec/confirm-close"; payload: { shouldClose: boolean } }
	| { type: "create-spec/focus" };

const EMPTY_FORM: CreateSpecFormData = {
	summary: "",
	productContext: "",
	technicalConstraints: "",
	openQuestions: "",
};

const AUTOSAVE_DEBOUNCE_MS = 600;
const MAX_FIELD_LENGTH = 5000;
const SUMMARY_HELPER_ID = "create-spec-summary-helper";

const normalizeFormData = (
	data: Partial<CreateSpecFormData> | undefined
): CreateSpecFormData => ({
	summary: typeof data?.summary === "string" ? data.summary : "",
	productContext:
		typeof data?.productContext === "string" ? data.productContext : "",
	technicalConstraints:
		typeof data?.technicalConstraints === "string"
			? data.technicalConstraints
			: "",
	openQuestions:
		typeof data?.openQuestions === "string" ? data.openQuestions : "",
});

const areFormsEqual = (
	left: CreateSpecFormData,
	right: CreateSpecFormData
): boolean =>
	left.summary === right.summary &&
	left.productContext === right.productContext &&
	left.technicalConstraints === right.technicalConstraints &&
	left.openQuestions === right.openQuestions;

const formatTimestamp = (timestamp: number | undefined): string | undefined => {
	if (!timestamp) {
		return;
	}

	try {
		return new Intl.DateTimeFormat(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(timestamp));
	} catch {
		return;
	}
};

const readPersistedDraft = (): CreateSpecDraftState | undefined => {
	const raw = vscode.getState() as CreateSpecDraftState | undefined;
	if (!raw) {
		return;
	}

	if (!raw.formData || typeof raw.lastUpdated !== "number") {
		return;
	}

	return {
		formData: normalizeFormData(raw.formData),
		lastUpdated: raw.lastUpdated,
	};
};

export const CreateSpecView = () => {
	const [formData, setFormData] = useState<CreateSpecFormData>(EMPTY_FORM);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ summary?: string }>({});
	const [submissionError, setSubmissionError] = useState<string | undefined>();
	const [draftSavedAt, setDraftSavedAt] = useState<number | undefined>();
	const [closeWarningVisible, setCloseWarningVisible] = useState(false);

	const lastPersistedRef = useRef<CreateSpecFormData>(EMPTY_FORM);
	const autosaveTimeoutRef = useRef<number | undefined>();

	const summaryRef = useRef<HTMLTextAreaElement>(null);
	const productContextRef = useRef<HTMLTextAreaElement>(null);
	const technicalConstraintsRef = useRef<HTMLTextAreaElement>(null);
	const openQuestionsRef = useRef<HTMLTextAreaElement>(null);

	const isDirty = useMemo(
		() => !areFormsEqual(formData, lastPersistedRef.current),
		[formData]
	);

	const clearAutosaveTimer = useCallback(() => {
		if (autosaveTimeoutRef.current) {
			window.clearTimeout(autosaveTimeoutRef.current);
			autosaveTimeoutRef.current = undefined;
		}
	}, []);

	const persistDraft = useCallback((data: CreateSpecFormData) => {
		const normalized = normalizeFormData(data);
		if (areFormsEqual(normalized, lastPersistedRef.current)) {
			return;
		}

		const nextState: CreateSpecDraftState = {
			formData: normalized,
			lastUpdated: Date.now(),
		};

		lastPersistedRef.current = normalized;
		setDraftSavedAt(nextState.lastUpdated);
		vscode.setState(nextState);
		vscode.postMessage({ type: "create-spec/autosave", payload: normalized });
	}, []);

	const scheduleAutosave = useCallback(
		(data: CreateSpecFormData) => {
			clearAutosaveTimer();
			autosaveTimeoutRef.current = window.setTimeout(() => {
				persistDraft(data);
			}, AUTOSAVE_DEBOUNCE_MS);
		},
		[clearAutosaveTimer, persistDraft]
	);

	const handleFieldChange = useCallback(
		(field: keyof CreateSpecFormData) =>
			(event: ChangeEvent<HTMLTextAreaElement>) => {
				const value = event.target.value.slice(0, MAX_FIELD_LENGTH);
				setFormData((previous) => {
					const next = {
						...previous,
						[field]: value,
					};
					scheduleAutosave(next);
					return next;
				});
			},
		[scheduleAutosave]
	);

	const validateForm = useCallback((current: CreateSpecFormData): boolean => {
		const trimmedSummary = current.summary.trim();
		if (!trimmedSummary) {
			setFieldErrors({ summary: "Summary is required." });
			summaryRef.current?.focus();
			return false;
		}

		setFieldErrors({});
		return true;
	}, []);

	const handleSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (isSubmitting) {
				return;
			}

			const normalized = normalizeFormData({
				...formData,
				summary: formData.summary.trim(),
			});

			if (!validateForm(normalized)) {
				return;
			}

			clearAutosaveTimer();
			setIsSubmitting(true);
			setSubmissionError(undefined);

			vscode.postMessage({
				type: "create-spec/submit",
				payload: normalized,
			});
		},
		[clearAutosaveTimer, formData, isSubmitting, validateForm]
	);

	const handleCancel = useCallback(() => {
		clearAutosaveTimer();
		vscode.postMessage({
			type: "create-spec/close-attempt",
			payload: { hasDirtyChanges: isDirty },
		});
	}, [clearAutosaveTimer, isDirty]);

	const focusSummaryField = useCallback(() => {
		window.setTimeout(() => {
			summaryRef.current?.focus();
		}, 0);
	}, []);

	const handleInitMessage = useCallback(
		(initPayload?: CreateSpecInitPayload) => {
			const draftData = normalizeFormData(initPayload?.draft?.formData);
			lastPersistedRef.current = draftData;
			setFormData(draftData);
			setDraftSavedAt(initPayload?.draft?.lastUpdated);
			setSubmissionError(undefined);
			setIsSubmitting(false);
			setFieldErrors({});
			setCloseWarningVisible(false);
			vscode.setState(initPayload?.draft);

			if (initPayload?.shouldFocusPrimaryField) {
				focusSummaryField();
			}
		},
		[focusSummaryField]
	);

	useEffect(() => {
		const persistedDraft = readPersistedDraft();
		if (persistedDraft) {
			lastPersistedRef.current = persistedDraft.formData;
			setFormData(persistedDraft.formData);
			setDraftSavedAt(persistedDraft.lastUpdated);
		}

		vscode.postMessage({ type: "create-spec/ready" });

		return () => {
			clearAutosaveTimer();
		};
	}, [clearAutosaveTimer]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<CreateSpecExtensionMessage>) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}

			switch (payload.type) {
				case "create-spec/init": {
					handleInitMessage(payload.payload);
					break;
				}
				case "create-spec/submit:success": {
					setIsSubmitting(false);
					setSubmissionError(undefined);
					break;
				}
				case "create-spec/submit:error": {
					setIsSubmitting(false);
					setSubmissionError(payload.payload?.message ?? "Failed to submit.");
					break;
				}
				case "create-spec/confirm-close": {
					setCloseWarningVisible(!payload.payload?.shouldClose);
					break;
				}
				case "create-spec/focus": {
					focusSummaryField();
					break;
				}
				default:
					break;
			}
		};

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
		};
	}, [focusSummaryField, handleInitMessage]);

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirty) {
				return;
			}

			event.preventDefault();
			event.returnValue = "";
			vscode.postMessage({
				type: "create-spec/close-attempt",
				payload: { hasDirtyChanges: true },
			});
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [isDirty]);

	const renderHelperText = () => {
		if (submissionError) {
			return (
				<div
					className="srgb,var(--vscode-errorForeground)_12%,transparent)] rounded-md border border-[var(--vscode-errorForeground)] bg-[color-mix(in px-3 py-2 text-[var(--vscode-errorForeground)] text-sm"
					role="alert"
				>
					{submissionError}
				</div>
			);
		}

		if (closeWarningVisible) {
			return (
				<div className="rounded-md border border-[color:color-mix(in_srgb,var(--vscode-warningForeground)_50%,transparent)] bg-[color:color-mix(in_srgb,var(--vscode-warningForeground)_12%,transparent)] px-3 py-2 text-[var(--vscode-warningForeground)] text-sm">
					Changes are still available. Close action was cancelled.
				</div>
			);
		}

		return;
	};

	const lastSavedLabel = formatTimestamp(draftSavedAt);
	const autosaveStatus = useMemo(() => {
		if (lastSavedLabel) {
			return `Draft saved at ${lastSavedLabel}`;
		}

		if (isDirty) {
			return "Unsaved changes";
		}

		return "All changes saved";
	}, [isDirty, lastSavedLabel]);

	return (
		<div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-6 px-4 py-6">
			<header className="flex flex-col gap-2">
				<h1 className="font-semibold text-2xl text-[color:var(--vscode-foreground)]">
					Create New Spec
				</h1>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
					Provide context for the new specification. Summary is required; other
					sections are optional but recommended.
				</p>
			</header>

			{renderHelperText()}

			<form
				className="flex flex-1 flex-col gap-6"
				noValidate
				onSubmit={handleSubmit}
			>
				<section className="flex flex-1 flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label
							className="font-medium text-[color:var(--vscode-foreground)] text-sm"
							htmlFor="create-spec-summary"
						>
							Summary{" "}
							<span className="text-[color:var(--vscode-errorForeground)]">
								*
							</span>
						</label>
						<TextareaPanel
							containerClassName="shadow-[0_16px_32px_rgba(0,0,0,0.25)]"
							disabled={isSubmitting}
							onChange={handleFieldChange("summary")}
							placeholder="Capture the key outcome you want to achieve…"
							rows={4}
							textareaClassName="min-h-[6rem] text-sm leading-6"
							textareaProps={{
								id: "create-spec-summary",
								name: "summary",
								"aria-required": true,
								"aria-invalid": fieldErrors.summary ? true : undefined,
								"aria-describedby": SUMMARY_HELPER_ID,
							}}
							textareaRef={summaryRef}
							value={formData.summary}
						>
							<div
								className="flex items-center justify-between px-3 text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.6))] text-xs"
								id={SUMMARY_HELPER_ID}
							>
								<span>
									{Math.max(0, MAX_FIELD_LENGTH - formData.summary.length)}{" "}
									characters remaining
								</span>
								{fieldErrors.summary ? (
									<span className="text-[color:var(--vscode-errorForeground)]">
										{fieldErrors.summary}
									</span>
								) : null}
							</div>
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
							onChange={handleFieldChange("productContext")}
							placeholder="Describe current product state, users, or constraints…"
							rows={3}
							textareaClassName="min-h-[5rem] text-sm leading-6"
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
							onChange={handleFieldChange("technicalConstraints")}
							placeholder="List architecture decisions, deadlines, or compliance needs…"
							rows={3}
							textareaClassName="min-h-[5rem] text-sm leading-6"
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
							onChange={handleFieldChange("openQuestions")}
							placeholder="Capture unknowns, dependencies, or risks to explore…"
							rows={3}
							textareaClassName="min-h-[5rem] text-sm leading-6"
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
							onClick={handleCancel}
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
		</div>
	);
};

export default CreateSpecView;
