import "./app.css";

import { createRoot } from "react-dom/client";
import { InteractiveView } from "./features/interactive-view";
import { SimpleView } from "./features/simple-view";

const container = document.getElementById("root")!;
const root = createRoot(container);

const page = container.dataset.page || "simple";

switch (page) {
	case "simple":
		root.render(<SimpleView />);
		break;
	case "interactive":
		root.render(<InteractiveView />);
		break;
	default:
		root.render(<div style={{ padding: 12 }}>Unknown page: {page}</div>);
}
