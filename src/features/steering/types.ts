export type CreateSteeringFormData = {
	summary: string;
	audience: string;
	keyPractices: string;
	antiPatterns: string;
};

export type CreateSteeringDraftState = {
	formData: CreateSteeringFormData;
	lastUpdated: number;
};

export type CreateSteeringInitPayload = {
	shouldFocusPrimaryField: boolean;
	draft?: CreateSteeringDraftState;
};

export type CreateSteeringExtensionMessage =
	| { type: "create-steering/init"; payload: CreateSteeringInitPayload }
	| { type: "create-steering/submit:success" }
	| { type: "create-steering/submit:error"; payload: { message: string } }
	| { type: "create-steering/confirm-close"; payload: { shouldClose: boolean } }
	| { type: "create-steering/focus" };

export type CreateSteeringFieldErrors = {
	summary?: string;
};

export type CreateSteeringSubmitMessage = {
	type: "create-steering/submit";
	payload: CreateSteeringFormData;
};

export type CreateSteeringAutosaveMessage = {
	type: "create-steering/autosave";
	payload: CreateSteeringFormData;
};

export type CreateSteeringCloseAttemptMessage = {
	type: "create-steering/close-attempt";
	payload: { hasDirtyChanges: boolean };
};

export type CreateSteeringCancelMessage = {
	type: "create-steering/cancel";
};

export type CreateSteeringReadyMessage = {
	type: "create-steering/ready";
};

export type CreateSteeringWebviewMessage =
	| CreateSteeringSubmitMessage
	| CreateSteeringAutosaveMessage
	| CreateSteeringCloseAttemptMessage
	| CreateSteeringCancelMessage
	| CreateSteeringReadyMessage;
