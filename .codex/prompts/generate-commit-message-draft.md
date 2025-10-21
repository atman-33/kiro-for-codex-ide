# Generate Commit Message

You are a coding assistant operating at the root of a Git repository.
Follow the steps below carefully. If any step fails, continue the process and note the reason in the `Notes` section at the end of the output.

## Goal

* Analyze the **currently staged changes** and generate a **commit message**.
* Reference the **last 5 commit messages** to infer the repository’s preferred writing style (format, tone, and conventions).
* Output the final message to **`.tmp/commit-message-draft.md`**, **completely overwriting** any existing content.

---

## Steps

1. **Preconditions**

   * Assume the working directory is the repository root.
   * If any Git command fails, continue and record the cause under `Notes`.

2. **Check staged files**

   * Run:

     * `git diff --staged --name-status`
     * `git diff --staged`
   * If there are **no staged changes**, write the following to `.tmp/commit-message-draft.md` and stop:

     ```
     # Commit Message (Draft)

     No staged changes were found.
     ```
   * If staged files exist, proceed.

3. **Analyze the last 5 commit messages**

   * Run:
     `git log -n 5 --pretty=format:%H%n%s%n%b%n---END---`
   * From these messages, infer:

     * Title format (e.g., `feat: ...`, `Fix ...`, etc.)
     * Language (English or Japanese dominant)
     * Title length range (e.g., 50–72 chars)
     * Body structure (paragraphs vs. bullet points, use of `BREAKING CHANGE:` or `Refs #123`)
     * Presence of footers (`Co-authored-by`, etc.)
   * Adopt a **consistent style** for the new message.

4. **Summarize staged changes**

   * For each file, describe its intent in 1–2 sentences (why, what, how).
   * Order the summary by importance: major → minor changes.
   * If any destructive or API-breaking modifications are detected, add
     `BREAKING CHANGE:` at the end of the body.
   * If related issue/PR numbers can be inferred, include `Refs #<number>` in the footer.

5. **Compose the commit message**

   * **Title**:

     * Follow the style from the last 5 commits (e.g., Conventional Commits if used).
     * Use `(scope)` if an appropriate context can be inferred.
     * Keep it concise and meaningful (≤ 72 characters).
   * **Body**:

     * Explain background, purpose, main changes (use bullet points if helpful), and impact.
     * Match the previously detected language and tone.
     * Wrap lines around 72 characters where possible.
   * **Footer**:

     * Include any `Refs`, `Co-authored-by`, or `BREAKING CHANGE` lines consistent with prior commits.

6. **Output**

   * Create the `.tmp` directory if it doesn’t exist.
   * Write to `.tmp/commit-message-draft.md` in UTF-8 with LF line endings.
   * **Completely clear existing contents before writing**.
   * Follow this exact output format:

     ```
     # Commit Message (Draft)

     ## Title
     <Write the single-line title here>

     ## Body
     <Short description of background/purpose>
     - <Main change 1>
     - <Main change 2>
     - <Main change 3>
     <Impact, migration, or test information>

     ## Footer
     <Refs #123 / Co-authored-by: ... / BREAKING CHANGE: ...>

     ## Notes
     <Any missing info, inferred reasoning, or style observations from the last 5 commits (2–4 bullet points)>
     ```

---

## Definition of Done

* The staged area is analyzed, and the message matches the **style and tone** of the last 5 commits.
* The **title** is concise (≤ 72 chars).
* The **body** clearly explains the intention and impact, not just a list of files.
* `.tmp/commit-message-draft.md` exists and is fully overwritten.
* Any limitations or uncertainties are summarized in `## Notes`.

---

## Optional References

* You may additionally consult:

  * `git status --porcelain`
  * `git diff --staged --stat`
  * `git show --stat --oneline HEAD`
* If the previous commits follow **Conventional Commits**, prioritize `type(scope): subject`.
* Use **English** or **Japanese** depending on which language dominates in recent commits — avoid mixing both.
