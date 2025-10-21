import "./app.css";

import { createRoot } from "react-dom/client";
import { getPageRenderer } from "./page-registry";

const container = document.getElementById("root")!;
const root = createRoot(container);

const page = container.dataset.page || "simple";

const renderer = getPageRenderer(page);

if (renderer) {
	root.render(renderer());
} else {
	root.render(<div style={{ padding: 12 }}>Unknown page: {page}</div>);
}
