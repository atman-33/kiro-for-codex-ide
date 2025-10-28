import { vscode } from "@/bridge/vscode";
import { CreateSteeringForm } from "./components/create-steering-form";
import { StatusBanner } from "../create-spec-view/components/status-banner";
import type {
	CreateSteeringDraftState,
	CreateSteeringExtensionMessage,
	CreateSteeringFieldErrors,
	CreateSteeringFormData,
	CreateSteeringInitPayload,
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

const EMPTY_FORM: CreateSteeringFormData = {
	summary: "",
	audience: "",
	keyPractices: "",
	antiPatterns: "",
};

const AUTOSAVE_DEBOUNCE_MS = 600;
const normalizeFormData = (
	data: Partial<CreateSteeringFormData> | undefined
): CreateSteeringFormData => ({
	summary: typeof data?.summary === "string" ? data.summary : "",
	audience: typeof data?.audience === "string" ? data.audience : "",
	keyPractices: typeof data?.keyPractices === "string" ? data.keyPractices : "",
	antiPatterns: typeof data?.antiPatterns === "string" ? data.antiPatterns : "",
});

const areFormsEqual = (
	left: CreateSteeringFormData,
	right: CreateSteeringFormData
): boolean =>
	left.summary === right.summary &&
	left.audience === right.audience &&
	left.keyPractices === right.keyPractices &&
	left.antiPatterns === right.antiPatterns;

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

const readPersistedDraft = (): CreateSteeringDraftState | undefined => {
	const raw = vscode.getState() as CreateSteeringDraftState | undefined;
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

export const CreateSteeringView = () => {
	const [formData, setFormData] = useState<CreateSteeringFormData>(EMPTY_FORM);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<CreateSteeringFieldErrors>({});
	const [submissionError, setSubmissionError] = useState<string | undefined>();
	const [draftSavedAt, setDraftSavedAt] = useState<number | undefined>();
	const [closeWarningVisible, setCloseWarningVisible] = useState(false);

	const lastPersistedRef = useRef<CreateSteeringFormData>(EMPTY_FORM);
	const autosaveTimeoutRef = useRef<number | undefined>();

	const summaryRef = useRef<HTMLTextAreaElement>(null);
	const audienceRef = useRef<HTMLTextAreaElement>(null);
	const keyPracticesRef = useRef<HTMLTextAreaElement>(null);
	const antiPatternsRef = useRef<HTMLTextAreaElement>(null);

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

	const persistDraft = useCallback((data: CreateSteeringFormData) => {
		const normalized = normalizeFormData(data);
		if (areFormsEqual(normalized, lastPersistedRef.current)) {
			return;
		}

		const nextState: CreateSteeringDraftState = {
			formData: normalized,
			lastUpdated: Date.now(),
		};

		lastPersistedRef.current = normalized;
		setDraftSavedAt(nextState.lastUpdated);
		vscode.setState(nextState);
		vscode.postMessage({
			type: "create-steering/autosave",
			payload: normalized,
		});
	}, []);

	const scheduleAutosave = useCallback(
		(data: CreateSteeringFormData) => {
			clearAutosaveTimer();
			autosaveTimeoutRef.current = window.setTimeout(() => {
				persistDraft(data);
			}, AUTOSAVE_DEBOUNCE_MS);
		},
		[clearAutosaveTimer, persistDraft]
	);

	const handleFieldChange = useCallback(
		(field: keyof CreateSteeringFormData) =>
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

	const validateForm = useCallback(
		(current: CreateSteeringFormData): boolean => {
			const trimmedSummary = current.summary.trim();
			if (!trimmedSummary) {
				setFieldErrors({ summary: "Guidance summary is required." });
				summaryRef.current?.focus();
				return false;
			}

			setFieldErrors({});
			return true;
		},
		[]
	);

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
				type: "create-steering/submit",
				payload: normalized,
			});
		},
		[clearAutosaveTimer, formData, isSubmitting, validateForm]
	);

	const handleCancel = useCallback(() => {
		clearAutosaveTimer();
		vscode.postMessage({
			type: "create-steering/close-attempt",
			payload: { hasDirtyChanges: isDirty },
		});
	}, [clearAutosaveTimer, isDirty]);

	const focusSummaryField = useCallback(() => {
		window.setTimeout(() => {
			summaryRef.current?.focus();
		}, 0);
	}, []);

	const handleInitMessage = useCallback(
		(initPayload?: CreateSteeringInitPayload) => {
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

		vscode.postMessage({ type: "create-steering/ready" });

		return () => {
			clearAutosaveTimer();
		};
	}, [clearAutosaveTimer]);

	useEffect(() => {
		const handleMessage = (
			event: MessageEvent<CreateSteeringExtensionMessage>
		) => {
			const payload = event.data;
			if (!payload || typeof payload !== "object") {
				return;
			}

			switch (payload.type) {
				case "create-steering/init": {
					handleInitMessage(payload.payload);
					break;
				}
				case "create-steering/submit:success": {
					setIsSubmitting(false);
					setSubmissionError(undefined);
					break;
				}
				case "create-steering/submit:error": {
					setIsSubmitting(false);
					setSubmissionError(
						payload.payload?.message ?? "Failed to submit steering prompt."
					);
					break;
				}
				case "create-steering/confirm-close": {
					setCloseWarningVisible(!payload.payload?.shouldClose);
					break;
				}
				case "create-steering/focus": {
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
				type: "create-steering/close-attempt",
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
					Sending steering prompt…
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
					Create Custom Steering
				</h1>
				<p className="text-[color:var(--vscode-descriptionForeground,rgba(255,255,255,0.65))] text-sm">
					Share the guardrails and project-specific rules you want every agent
					to follow. Summary is required; other sections are optional.
				</p>
			</header>

			{statusBanner}

			<CreateSteeringForm
				antiPatternsRef={antiPatternsRef}
				audienceRef={audienceRef}
				autosaveStatus={autosaveStatus}
				fieldErrors={fieldErrors}
				formData={formData}
				isSubmitting={isSubmitting}
				keyPracticesRef={keyPracticesRef}
				onCancel={handleCancel}
				onFieldChange={handleFieldChange}
				onSubmit={handleSubmit}
				summaryRef={summaryRef}
			/>
		</div>
	);
};

export default CreateSteeringView;
