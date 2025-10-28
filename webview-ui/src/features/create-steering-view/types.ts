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

export type CreateSteeringWebviewMessage =
	| { type: "create-steering/submit"; payload: CreateSteeringFormData }
	| { type: "create-steering/autosave"; payload: CreateSteeringFormData }
	| {
			type: "create-steering/close-attempt";
			payload: { hasDirtyChanges: boolean };
	  }
	| { type: "create-steering/cancel" }
	| { type: "create-steering/ready" };
