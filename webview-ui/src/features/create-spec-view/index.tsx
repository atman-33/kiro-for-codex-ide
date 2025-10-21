import { vscode } from "@/bridge/vscode";
import { CreateSpecForm } from "./components/create-spec-form";
import { StatusBanner } from "./components/status-banner";
import type {
	CreateSpecDraftState,
	CreateSpecExtensionMessage,
	CreateSpecFieldErrors,
	CreateSpecFormData,
	CreateSpecInitPayload,
} from "./types";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type FormEvent,
} from "react";

const EMPTY_FORM: CreateSpecFormData = {
	summary: "",
	productContext: "",
	technicalConstraints: "",
	openQuestions: "",
};

const AUTOSAVE_DEBOUNCE_MS = 600;
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
	const [fieldErrors, setFieldErrors] = useState<CreateSpecFieldErrors>({});
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
				const value = event.target.value;
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

	const statusBanner = useMemo(() => {
		if (submissionError) {
			return (
				<StatusBanner ariaLive="assertive" role="alert" tone="error">
					{submissionError}
				</StatusBanner>
			);
		}

		if (closeWarningVisible) {
			return (
				<StatusBanner role="status" tone="warning">
					Changes are still available. Close action was cancelled.
				</StatusBanner>
			);
		}

		if (isSubmitting) {
			return (
				<StatusBanner role="status" tone="info">
					Sending spec prompt…
				</StatusBanner>
			);
		}

		return null;
	}, [closeWarningVisible, isSubmitting, submissionError]);

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

			{statusBanner}

			<CreateSpecForm
				autosaveStatus={autosaveStatus}
				fieldErrors={fieldErrors}
				formData={formData}
				isSubmitting={isSubmitting}
				onCancel={handleCancel}
				onFieldChange={handleFieldChange}
				onSubmit={handleSubmit}
				openQuestionsRef={openQuestionsRef}
				productContextRef={productContextRef}
				summaryRef={summaryRef}
				technicalConstraintsRef={technicalConstraintsRef}
			/>
		</div>
	);
};

export default CreateSpecView;
