# Generate Pull Request Title and Description (Interactive Workflow)

You are a member of a software development team.
Your task is to create a **clear, concise, and professional Pull Request (PR) title and description** — step by step, with user confirmation at each stage.

---

## Workflow Steps

### **Step 1 — Confirm Target Branch**

Ask the user which branch the PR will be merged **into** (target branch).
If the user does not specify, suggest `main` as the default.

> Example:
> “Which branch should this PR target? (default: main)”

---

### **Step 2 — Generate Draft PR Message**

Once the target branch is confirmed:

1. Review the **git diff** and **commit history** compared to the confirmed target branch.
2. Generate both a **PR title** and **PR body draft**.
3. Write the draft message to `.tmp/pull-request-message-draft.md`.

**File Rules:**

* If the file already exists, **clear its contents completely before writing**.
* Save the file in **UTF-8 (LF)** encoding.

Use the following **template** for the draft:

```
### Overview
Briefly summarize what changes this PR introduces.

### Changes
- List the main modifications in bullet points.  
- Make it understandable even for someone who doesn’t read the source code.
```

---

### **Step 3 — Ask for User Review**

After generating the draft file, show a short preview and ask:

> “Please review the draft in `.tmp/pull-request-message-draft.md`.
> Would you like to revise it, or proceed to create the Pull Request?”

If the user requests changes, regenerate the draft accordingly.

---

### **Step 4 — Create the Pull Request**

When the user approves the draft:

* Run the following command to create the Pull Request automatically using GitHub CLI:

```
gh pr create --fill --title "<generated title>" --body-file .tmp/pull-request-message-draft.md --base <target branch>
```

Confirm successful creation, and display the resulting PR link.

---

## Additional Requirements

1. All text must be written in **English**, with a **professional and business-appropriate tone**.
2. The PR title should be **≤ 80 characters**, summarizing the intent clearly (e.g., “Add autosave logic to CreateSpec controller”).
3. Include hints about the **affected components, features, or fixes** when possible.
4. Ensure the output file `.tmp/pull-request-message-draft.md` contains **only the new generated message**, with no leftover content.
