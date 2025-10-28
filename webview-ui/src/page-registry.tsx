import { CreateSpecView } from "./features/create-spec-view";
import { CreateSteeringView } from "./features/create-steering-view";
import { InteractiveView } from "./features/interactive-view";
import { SimpleView } from "./features/simple-view";

export type SupportedPage =
	| "simple"
	| "interactive"
	| "create-spec"
	| "create-steering";

const pageRenderers = {
	simple: () => <SimpleView />,
	interactive: () => <InteractiveView />,
	"create-spec": () => <CreateSpecView />,
	"create-steering": () => <CreateSteeringView />,
} satisfies Record<SupportedPage, () => JSX.Element>;

export const getPageRenderer = (pageName: string) => {
	if (pageName in pageRenderers) {
		return pageRenderers[pageName as SupportedPage];
	}

	return;
};
