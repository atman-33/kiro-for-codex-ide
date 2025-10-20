# Generate Pull Request Title and Description from Git Diff and Commits

You are a member of a software development team.
Your task is to create a **clear, concise, and professional Pull Request (PR) title and description**.

* **Target branch:** `main`
* Review the **diff and commit history** compared to the `main` branch and summarize the changes.

---

## Output Requirements

1. **Generate both a PR title and PR body.**
2. **Write the PR message to `.tmp/pull-request-message-draft.md`.**

   * If the file already exists, **completely clear its contents before writing**.
   * Save the file in **UTF-8 (LF)** encoding.
3. Follow the template below for the PR body.

---

## Output Template

```
# Pull Request Message (Draft)

## Title
<Write the PR title here>

## Body

### Overview
Briefly summarize what changes this PR introduces.

### Changes
- List the main modifications in bullet points.  
- Make it understandable even for someone who doesn’t read the source code.
```

---

## Generation Instructions

1. Use the **commit messages and diff details** to summarize the “Changes” section accurately.
2. Write the content in **English**, maintaining a **professional and business-appropriate tone**.
3. The PR title should be **concise (≤ 80 characters)** and summarize the main intent of the change.
4. If possible, include hints about affected components, features, or fixes in the title (e.g., “Fix build script error in CI pipeline”).
5. Ensure the output file `.tmp/pull-request-message-draft.md` contains **only the new generated message**, with no leftover content.
