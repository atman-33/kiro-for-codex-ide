export type CreateSpecFormData = {
	summary: string;
	productContext: string;
	technicalConstraints: string;
	openQuestions: string;
};

export type CreateSpecDraftState = {
	formData: CreateSpecFormData;
	lastUpdated: number;
};

export type CreateSpecInitPayload = {
	shouldFocusPrimaryField: boolean;
	draft?: CreateSpecDraftState;
};

export type CreateSpecSubmitSuccessMessage = {
	type: "create-spec/submit:success";
};

export type CreateSpecSubmitErrorMessage = {
	type: "create-spec/submit:error";
	payload: { message: string };
};

export type CreateSpecConfirmCloseMessage = {
	type: "create-spec/confirm-close";
	payload: { shouldClose: boolean };
};

export type CreateSpecFocusMessage = {
	type: "create-spec/focus";
};

export type CreateSpecInitMessage = {
	type: "create-spec/init";
	payload: CreateSpecInitPayload;
};

export type CreateSpecExtensionMessage =
	| CreateSpecInitMessage
	| CreateSpecSubmitSuccessMessage
	| CreateSpecSubmitErrorMessage
	| CreateSpecConfirmCloseMessage
	| CreateSpecFocusMessage;

export type CreateSpecSubmitMessage = {
	type: "create-spec/submit";
	payload: CreateSpecFormData;
};

export type CreateSpecAutosaveMessage = {
	type: "create-spec/autosave";
	payload: CreateSpecFormData;
};

export type CreateSpecCloseAttemptMessage = {
	type: "create-spec/close-attempt";
	payload: { hasDirtyChanges: boolean };
};

export type CreateSpecCancelMessage = { type: "create-spec/cancel" };

export type CreateSpecReadyMessage = { type: "create-spec/ready" };

export type CreateSpecWebviewMessage =
	| CreateSpecSubmitMessage
	| CreateSpecAutosaveMessage
	| CreateSpecCloseAttemptMessage
	| CreateSpecCancelMessage
	| CreateSpecReadyMessage;
