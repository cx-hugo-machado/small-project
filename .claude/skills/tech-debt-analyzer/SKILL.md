---
name: tech-debt-analyzer
description: Analyzes team repositories to discover shared patterns, then uses those patterns as a baseline to identify real tech debt in the current working directory — not arbitrary best practices, but actual divergences from how your team builds software. Supports three analysis modes: full repository, staged files only (pre-commit), or uncommitted working tree changes. Invoke when the user asks to find tech debt, identify code quality gaps, check for inconsistencies in the codebase, analyze technical debt, review what needs to be cleaned up, check their changes before committing, or asks questions like "do I have tech debt?", "what are the gaps in this repo?", "find issues in this codebase", "what should I fix in this repository?", "check my staged changes", "review before I commit", or "is there tech debt in what I changed?".
metadata:
  author: cx-hugo-machado
  version: "1.2.0"
---

## Overview

### Purpose

Most tech debt tools flag deviations from generic industry best practices. This skill is different: it first learns how *your team* actually builds software — naming conventions, architecture, error handling, logging, test structure — and uses that as the baseline. Only deviations from your team's real patterns (or universally dangerous issues) are reported as debt.

### When to Use

Use this skill when:
- You want a tech debt report that reflects your team's actual standards, not a linter's opinion
- Onboarding a new repository and want to measure alignment with team norms
- Your team suspects inconsistency is growing across repos but needs evidence
- You want to distinguish intentional architectural choices from actual debt
- You want to check your staged changes for debt **before committing**
- You want to review uncommitted working tree changes before pushing

### Expected Outcome

After running this skill you will have:
- A `team-patterns.md` baseline capturing your team's real conventions across all repositories
- A complete tech debt report for the current repository — every finding ordered by priority, with a fix note per item, so you can decide what to address and how
- A persistent `findings-state.md` that carries acknowledged items forward so re-runs don't repeat noise

---

## Prerequisites

### Knowledge Required

- Familiarity with your team's repository structure and locations
- Basic understanding of what counts as intentional vs accidental in your codebase

### Tools & Resources

- Claude Code with file read access to your team's repositories
- Repository sources for pattern discovery — either absolute local paths or GitHub URLs (e.g. `https://github.com/org/repo`), provided at invocation time
- For GitHub repositories: `gh` CLI authenticated (`gh auth login`)

> **Language support:** The skill auto-detects the primary language of each repo (Go, TypeScript/JavaScript, Python, Rust, Java/Kotlin) and applies language-appropriate extraction. Mixed-language repos are analyzed based on the dominant language by file count.

---

## Instructions

**Invoke with:** `/tech-debt-analyzer` or any natural language prompt expressing intent to find tech debt or review changes — for example:

*Full repository analysis:*
- "find tech debt issues in this repository"
- "do I have tech debt gaps in this repo?"
- "what needs to be cleaned up in this codebase?"
- "analyze code quality issues here"

*Pre-commit (staged files only):*
- "check my staged changes for tech debt"
- "review before I commit"
- "is there tech debt in what I'm about to commit?"

*Working tree (all uncommitted changes):*
- "check my changes for debt"
- "is there tech debt in what I changed?"
- "review my uncommitted work"

The skill runs as a single continuous flow. There are two possible pauses: a human confirmation of discovered patterns (Step 4), and an optional prompt when repos have evolved (Step 1). Everything else is automatic.

---

### Step 0: Validate Working Directory

Before doing anything else:

1. **Check that the current working directory contains source files.** If it appears empty or documentation-only, stop and tell the user:
   > "The current directory doesn't appear to be a code repository. Please run this skill from the root of a repository you want to analyze."

2. **Detect the primary language** by looking for these files:
   - `go.mod` → Go
   - `package.json` → JavaScript / TypeScript
   - `requirements.txt`, `pyproject.toml`, `setup.py` → Python
   - `Cargo.toml` → Rust
   - `pom.xml`, `build.gradle` → Java / Kotlin
   - If multiple detected, use the language with the most source files.

3. **Determine the analysis mode** from the invocation context:

   | If the user said… | Mode |
   |---|---|
   | "check staged changes", "before I commit", "pre-commit", "what I'm about to commit" | **pre-commit** — analyze staged files only |
   | "check my changes", "what I changed", "uncommitted work", "my working tree" | **working-tree** — analyze all uncommitted changes |
   | Anything else / `/tech-debt-analyzer` with no qualifier | **full** — analyze the entire repository |

   If the mode is ambiguous (e.g., `/tech-debt-analyzer` with no context), ask once:
   > "Which files should I analyze? Reply: (1) full repository, (2) staged files only (pre-commit), or (3) all uncommitted changes."

   For **pre-commit** mode: run `git diff --staged --name-only` to get the file list.
   For **working-tree** mode: run `git diff --name-only` to get the file list.
   For **full** mode: no file list needed — the entire repository is the scope.

   If pre-commit or working-tree mode is selected but the output of the git command is empty, stop and tell the user:
   > "No staged changes found." (pre-commit) or "No uncommitted changes found." (working-tree)

4. **Check if the current directory is one of the repos stored in `## Baseline Metadata`** (if a baseline exists). If it is, note this to the user before proceeding:
   > "Note: this repository is part of the team baseline. Some patterns were derived from it — treat Consistency Debt findings with extra judgment, as they reflect divergence from what other repos do, not this one."

---

### Step 1: Check for Existing Team Baseline

Check whether `~/.claude/skills/tech-debt-analyzer/team-patterns.md` exists.

- **If it does not exist:** proceed to Step 2.
- **If it exists:** read the `## Baseline Metadata` section to extract the stored repo sources and their commit hashes. For each entry, get the current HEAD commit using the appropriate method:
  - **Local path** → `git rev-parse HEAD` inside the directory
  - **GitHub URL** → `gh api repos/{owner}/{repo}/commits?per_page=1` and read the first commit's SHA

  Then compare current HEAD against stored hash:
  - If **all hashes match** → load the baseline without any prompt or output, and skip to Step 5.
  - If **any repo has new commits** → list which repos changed and prompt:
    > "Your team baseline was generated on [date]. The following repos have new commits since then: [list]. Refresh the baseline before analyzing? (yes/no)"
    - **yes** → proceed to Step 2 (re-use stored sources, do not ask again)
    - **no** → load the existing baseline, skip to Step 5
  - If a stored path **no longer exists, is not a git repo, or a GitHub URL is unreachable** → skip that repo silently and continue with the rest. If **all** stored sources are unreachable, treat the baseline as missing and proceed to Step 2.

---

### Step 2: Ask for Repository Paths

If refreshing from an existing baseline, re-use the repo sources stored in `## Baseline Metadata` — do not ask again.

If no baseline exists, prompt the user once:
> "No team baseline found. Please provide your team's repositories, one per line. Each entry can be an absolute local path or a GitHub URL (e.g. `https://github.com/org/repo`). You can mix both."

Wait for the user's reply, then proceed automatically.

---

### Step 3: Discover Team Patterns

Spawn one subagent per repository using the **Pattern Discovery Prompt Template** (see end of Instructions). Each subagent determines the source type and scans accordingly:

- **Local path** → read files directly from the filesystem using `git ls-files` to avoid scanning untracked build artifacts
- **GitHub URL** → use `gh api repos/{owner}/{repo}/git/trees/HEAD?recursive=1` for structure, `gh api repos/{owner}/{repo}/contents/{path}` for individual files

**Exclusions — every subagent must skip:**
- Generated code: `*.pb.go`, `*_gen.go`, `*.generated.*`, `*.pb.*`
- Vendor directories: `vendor/`, `node_modules/`, `.yarn/`
- Mock files: `test/mocks/`, `*_mock.go`, `mock_*.go`
- Migration and schema files: `db/`, `migrations/`
- Build artifacts: `dist/`, `build/`, `bin/`, `out/`
- Hidden directories: `.git/`, `.github/`, `.idea/`

**Partial failure handling:** If a subagent fails (network error, rate limit, no response), log the failure and continue with the remaining repos. If **more than half** of subagents fail, stop and tell the user:
> "Pattern discovery failed for [N] of [total] repos: [list]. Too many failures to build a reliable baseline. Check your repository access and try again."

Merge all successful subagent findings. If a dimension yields no results for a given repo (e.g., a CLI tool with no logging), record it as `(none)` — do not skip it.

**Threshold — qualifying a team pattern:**

| Repos provided | Required to qualify as team pattern |
|---|---|
| 2 | Both repos (100%) |
| 3–5 | At least 3 |
| 6–9 | At least 60% (rounded up) |
| 10+ | At least 50% (rounded up) |

Patterns below the threshold are flagged as inconsistencies, not standards.

For each repo, record its current HEAD commit hash (same method as Step 1) for the `## Baseline Metadata` section written in Step 4.

---

### Step 4: Confirm Patterns with the User

**Number every individual pattern item** in the output. Show the discovered patterns and ask:
> "Do these patterns reflect your team's intentional standards? Reply with the numbers of any items to exclude (e.g. '2, 5, 8'), or reply 'looks good' to accept all."

Apply any exclusions. If a pattern dimension is empty across all repos, omit that section from `team-patterns.md` rather than writing `(none)`.

Write the final baseline to `~/.claude/skills/tech-debt-analyzer/team-patterns.md`, then proceed automatically.

The output format for `team-patterns.md`:

```markdown
# Team Patterns

## Baseline Metadata
<!-- Do not edit this section manually — it is used for change detection -->
generated: YYYY-MM-DD
repos:
  - source: /absolute/path/to/repo-1
    type: local
    head: <git commit hash>
  - source: https://github.com/org/repo-2
    type: github
    head: <git commit hash>

## Naming Conventions
- ...

## Architecture
- ...

## Shared Libraries
- ...

## Error Handling
- ...

## Logging
- ...

## Test Structure
- ...

## Inconsistencies (no clear team standard)
- ...
```

---

### Step 5: Load Findings State

Check whether `~/.claude/skills/tech-debt-analyzer/findings-state.md` exists. If it does, load it and collect all findings previously marked as `acknowledged` or `wont-fix` for the current repo. These will be silently excluded from the report in Step 7 to avoid repeating known, accepted items.

---

### Step 6: Analyze the Current Repository

Analyze against the loaded baseline using the scope determined in Step 0:

| Mode | Files to analyze |
|---|---|
| **full** | All source files in the current working directory |
| **pre-commit** | Only files returned by `git diff --staged --name-only` |
| **working-tree** | Only files returned by `git diff --name-only` |

Apply the same exclusion list from Step 3 regardless of mode.

> **Note on pre-commit and working-tree modes:** Test Coverage Debt (missing test files) is only reported if the changed files themselves lack a corresponding `_test.go` — do not flag unrelated untested files. The `## Untested Files` section is omitted from the report in these modes.

**Standards vs inconsistencies — apply the baseline selectively:**
- Patterns in `## Naming Conventions`, `## Architecture`, `## Shared Libraries`, `## Error Handling`, `## Logging`, `## Test Structure` → **do NOT flag as debt** (these are intentional team standards)
- Patterns in `## Inconsistencies` → **DO flag as Consistency Debt** if the current repo exhibits the minority variant

**Categorize findings:**

| Category | Definition |
|---|---|
| **Consistency Debt** | Deviates from a confirmed team standard, or exhibits the minority side of a known inconsistency |
| **Structural Debt** | Architecture or module boundary degradation |
| **Dependency Debt** | Outdated, mismatched, or absent dependencies vs team norm |
| **Test Coverage Debt** | Missing test files or untested code paths vs team conventions |
| **Test Quality Debt** | Tests present but violating team conventions (naming, mock strategy, assertion library) |

Also flag universally problematic issues regardless of team patterns: security vulnerabilities, broken dependencies, dead code, unsafe patterns. Classify these as **Security/Universal**.

**For each finding, include a brief fix note** — what specifically to change, referencing the team standard where applicable.

**Skip any finding** whose fingerprint (file + category + short description) matches an `acknowledged` or `wont-fix` entry in `findings-state.md`.

**Effort scale:**
- **S** — 1–2 hours: rename a file, fix a nil check, correct a test function name
- **M** — half day: rewrite error handling across a package, add tests for an untested file, migrate a dependency
- **L** — 1+ days: restructure a package boundary, write test suites for multiple untested components, coordinate a wire-format fix across repos

Use the **Analysis Prompt Template** (see end of Instructions) when spawning subagents for large repos.

---

### Step 7: Output the Report

All findings are included — nothing filtered except acknowledged items from Step 5. Sort by category priority: Security/Universal → Structural Debt → Dependency Debt → Consistency Debt → Test Coverage Debt → Test Quality Debt. Within each category, sort by effort ascending (S → M → L).

```markdown
# Tech Debt Report — [repo name] — [date] — [mode: Full / Pre-commit / Working Tree]

## Summary
- Total findings: N
- Security/Universal: N
- Structural Debt: N
- Dependency Debt: N
- Consistency Debt: N
- Test Coverage Debt: N
- Test Quality Debt: N
- Cross-Repo Inconsistencies noted: N

## All Findings
<!-- Ordered by category priority, then effort ascending -->

| # | File:Line | Category | Description | Fix | Effort |
|---|---|---|---|---|---|
| 1 | path/file.go:12 | Security/Universal | ... | ... | S |
| 2 | path/file.go:42 | Structural Debt | ... | ... | S |
| … | … | … | … | … | … |

## Untested Files
Internal source files with no corresponding _test.go:
- ...

## Cross-Repo Notes
Patterns inconsistent across team repos that are visible here:
- ...
```

---

### Step 8: Persist Findings State

After outputting the report, ask once:
> "Would you like to mark any findings as acknowledged so they won't appear in future reports? Reply with finding numbers and status — e.g. '3:wont-fix, 7:acknowledged' — or 'none'."

If the user provides numbers, write or update `~/.claude/skills/tech-debt-analyzer/findings-state.md`. Each entry records: repo name, file:line, category, brief description, status (`acknowledged` or `wont-fix`), and date marked.

If the user replies 'none', skip.

---

### Subagent Prompt Templates

#### Pattern Discovery Template

Use this prompt when spawning subagents in Step 3. Replace the placeholders before sending.

```
You are scanning a [LANGUAGE] repository to extract team coding patterns.

Source: [REPO_SOURCE]
Scan method: [local filesystem via git ls-files / gh api]

Skip entirely: vendor/, node_modules/, dist/, build/, bin/, .git/, .github/,
               *.pb.go, *_gen.go, *.generated.*, test/mocks/, *_mock.go,
               mock_*.go, db/, migrations/

Steps:
1. Get the full file list (git ls-files or gh api tree).
2. Read: the dependency manifest (go.mod / package.json / Cargo.toml /
   requirements.txt), entry point files (main.go / index.ts / main.py),
   2–3 representative source files per top-level package, 2–3 test files.
3. Extract and return ONLY this structure. Be specific — name actual files,
   libraries, patterns observed. Do not write generic descriptions.

## Naming Conventions
- File naming style and examples
- Package/module naming style
- Exported vs unexported identifier naming
- Constructor function naming pattern
- Interface/class naming pattern

## Architecture
- Module/package name
- Top-level directory structure (list actual dirs)
- Layering pattern and dependency flow

## Shared Libraries
- All direct dependencies with exact versions

## Error Handling
- Error creation method (errors.New / fmt.Errorf / custom types / exceptions)
- Error wrapping convention
- Error propagation style
- Sentinel or typed errors defined? (yes/no, examples)

## Logging
- Logging library and version
- Log level usage pattern
- Structured vs unstructured
- Context/correlation ID propagation

## Test Structure
- Test file placement and naming
- Test function naming convention
- Mock framework used
- Table-driven / parameterized tests? (yes/no)
- Assertion library

For any dimension where this repo has no relevant code, write: (none)
Return ONLY the structured markdown. No preamble, no summary.
```

#### Analysis Template

Use this prompt when spawning a subagent for Step 6 on large repositories.

```
You are performing a tech debt analysis of: [REPO_PATH]
Primary language: [LANGUAGE]

Skip: vendor/, node_modules/, dist/, build/, *.pb.go, *_gen.go,
      test/mocks/, *_mock.go, db/, migrations/

TEAM STANDARDS (do NOT flag these as debt):
[paste all sections of team-patterns.md EXCEPT ## Inconsistencies]

TEAM INCONSISTENCIES (DO flag the minority variant as Consistency Debt):
[paste ## Inconsistencies section from team-patterns.md]

EFFORT SCALE: S=1-2h, M=half day, L=1+ day

SCAN STEPS:
1. Read dependency manifest — compare each version against standards above.
2. List all source files in internal/ (or equivalent) — note which have no _test.go.
3. Read representative source files per package — check naming, error handling, logging.
4. Grep `func New` — verify each constructor validates nil dependencies.
5. Read all worker/handler/event files — check error return semantics (nil vs error).
6. Grep test files for `func Test` — verify naming pattern.
7. Grep test files for mock controller usage — check defer ctrl.Finish() presence.
8. Check for hardcoded secrets, raw SQL string concatenation, unvalidated inputs.

OUTPUT FORMAT — return only this, no commentary:

FINDINGS:
file:line | Category | Description | Fix | Effort (S/M/L)

MISSING_TEST_FILES:
file (one per line)
```

---

## Code Examples

### Example 1: First Run (no baseline yet)

**Scenario:** Running the skill for the first time on a team with mixed local and GitHub repos.

**Invocation:**
```
/tech-debt-analyzer
```

**Flow:**
```
Claude: [Step 0] Detected primary language: Go. Current directory is not
        in the baseline (no baseline exists yet).

Claude: No team baseline found. Please provide your team's repositories,
        one per line. Each entry can be an absolute local path or a
        GitHub URL. You can mix both.

User:   C:\Workspaces\GO\auth-service
        C:\Workspaces\GO\inventory-service
        https://github.com/my-org/notifications-service

Claude: [spawns subagents — local repos read via git ls-files,
         GitHub repo fetched via gh api]
        [merges findings, numbers each pattern item, shows discovered patterns]

        1. File naming: snake_case
        2. Package naming: lowercase single word
        3. Constructor pattern: New<TypeName>
        ...
        Do these patterns reflect your team's intentional standards?
        Reply with numbers to exclude, or 'looks good' to accept all.

User:   looks good

Claude: [writes team-patterns.md, checks findings-state.md — none exists]
        [analyzes current working directory]
        [outputs report]

Claude: Would you like to mark any findings as acknowledged so they won't
        appear in future reports? Reply with numbers and status
        (e.g. '3:wont-fix, 7:acknowledged') or 'none'.

User:   5:wont-fix

Claude: [writes findings-state.md with finding #5 marked as wont-fix]
```

---

### Example 2: Subsequent Run (baseline up to date)

**Scenario:** Running the skill again — `team-patterns.md` exists and no source repos have new commits.

**Invocation:**
```
/tech-debt-analyzer
```

**Flow:** Claude validates the directory, checks git HEAD for each stored repo, finds no changes, loads the baseline silently, loads `findings-state.md` (skips any acknowledged items), runs analysis, outputs report. Previously acknowledged findings do not appear.

---

### Example 3: Subsequent Run (repos have evolved)

**Scenario:** Running the skill after the team has merged new code into several repos.

**Invocation:**
```
/tech-debt-analyzer
```

**Flow:**
```
Claude: [Step 0] Detected: Go. This repo is part of the team baseline —
        treat Consistency Debt findings with extra judgment.

Claude: Your team baseline was generated on 2026-04-10.
        The following repos have new commits since then:
          - C:\Workspaces\GO\auth-service (3 commits ahead)
          - https://github.com/my-org/notifications-service (12 commits ahead)
        Refresh the baseline before analyzing? (yes/no)

User:   yes

Claude: [re-scans using stored sources, no need to re-enter paths]
        [shows numbered patterns for confirmation]
        Reply with numbers to exclude, or 'looks good' to accept all.

User:   looks good

Claude: [proceeds automatically to analysis and report]
```

**Expected Report:**
```
# Tech Debt Report — inventory-service — 2026-05-05

## Summary
- Total findings: 14
- Security/Universal: 1
- Structural Debt: 0
- Dependency Debt: 2
- Consistency Debt: 8
- Test Coverage Debt: 2
- Test Quality Debt: 1
- Cross-Repo Inconsistencies noted: 3

## All Findings

| # | File:Line | Category | Description | Fix | Effort |
|---|---|---|---|---|---|
| 1 | internal/auth/handler.go:12 | Security/Universal | Hardcoded connection string | Move to env var / config | S |
| 2 | go.mod:14 | Dependency Debt | grpc v1.79.3, team standard is v1.80.0 | Bump in go.mod and run go mod tidy | S |
| 3 | internal/worker/scan.go:88 | Consistency Debt | processEvent returns nil for DB failure | Return the error to trigger retry | S |
| … | … | … | … | … | … |
```

---

### Example 4: Pre-commit Analysis

**Scenario:** Developer has staged several files and wants to catch debt before committing.

**Invocation:**
```
check my staged changes for tech debt
```

**Flow:**
```
Claude: [Step 0] Mode detected: pre-commit.
        Running git diff --staged --name-only...
        4 staged files found:
          internal/rabbit/workers/scans/scan_deleted_worker.go
          internal/rabbit/workers/scans/scan_deleted_worker_test.go
          internal/models/project_result.go
          go.mod

        [loads baseline silently — all hashes match]
        [analyzes only the 4 staged files]

# Tech Debt Report — ai-sc-global-inventory — 2026-05-05 — Pre-commit

## Summary
- Total findings: 3
- Security/Universal: 0
- Structural Debt: 0
- Dependency Debt: 1
- Consistency Debt: 2
- Test Coverage Debt: 0
- Test Quality Debt: 0

## All Findings

| # | File:Line | Category | Description | Fix | Effort |
|---|---|---|---|---|---|
| 1 | go.mod:14 | Dependency Debt | grpc bumped to v1.82.0, team standard is v1.80.0 | Align with team standard or update team-patterns.md if intentional | S |
| 2 | internal/rabbit/workers/scans/scan_deleted_worker.go:124 | Consistency Debt | processEvent returns nil for DB failure | Return the error to trigger retry | S |
| 3 | internal/models/project_result.go:18 | Consistency Debt | Field named ResultId instead of ResultID | Rename to ResultID | S |
```

---

## Best Practices

### Do:

- [ ] Include all active team repositories when building the baseline, not just a subset
- [ ] Review the numbered pattern list carefully — exclude anything not intentional by number
- [ ] Trust automatic change detection — the skill prompts when repos have evolved
- [ ] Run from the repository root for complete coverage
- [ ] Use S/M/L estimates to sequence work: fix all S findings in a single session before touching M
- [ ] Share `team-patterns.md` with the team to make implicit standards explicit
- [ ] Use findings-state.md to acknowledge accepted deviations — keeps re-runs clean
- [ ] Use pre-commit mode regularly — catching debt before it's committed is cheaper than finding it in a full audit

### Don't:

- [ ] Include experimental or prototype repositories — they skew the baseline
- [ ] Treat every Consistency Debt finding as mandatory — it's context-dependent
- [ ] Modify files inside any repository during analysis — this skill is read-only
- [ ] Run the skill in a subdirectory — always start from the repo root

---

## Common Issues & Troubleshooting

### Issue 1: Pattern baseline is too noisy

**Symptoms:**
- Numbered pattern list includes one-off implementation details
- Items that clearly aren't intentional team standards

**Root Causes:**
- Prototype or experimental repositories were included
- Proportional threshold is still too low for the number of repos provided

**Solutions:**

1. Use the numbered exclusion mechanism during confirmation — reply with the numbers of non-standard items.
2. **Delete `team-patterns.md`** at `~/.claude/skills/tech-debt-analyzer/team-patterns.md` and re-run omitting the noisy repositories.

---

### Issue 2: The skill flags team patterns as debt

**Symptoms:**
- Findings include things your team does intentionally and consistently

**Root Causes:**
- The baseline is incomplete or was confirmed without reviewing carefully
- The pattern appears in fewer repos than the threshold requires

**Solutions:**

1. Re-run and choose to refresh the baseline — add the missing pattern manually during the numbered confirmation step.
2. Re-run with more repositories to broaden coverage.

---

### Issue 3: Change detection skips a repo

**Symptoms:**
- A repo with new commits is not flagged as changed

**Root Causes:**
- A local path in `## Baseline Metadata` was moved or deleted
- A GitHub URL is no longer accessible (renamed, deleted, permissions changed)

**Solutions:**

1. **Delete `team-patterns.md`** and re-run. You will be prompted for repo sources — provide the correct current locations.

---

### Issue 4: Subagent failure during pattern discovery

**Symptoms:**
- Skill stops with a message about too many failed repos
- Or: baseline appears to be missing patterns from some repos

**Root Causes:**
- Network issues or GitHub API rate limiting
- A repository is very large (context overflow in subagent)

**Solutions:**

1. Re-run after a few minutes if the cause is rate limiting.
2. For very large repos: remove them from the baseline sources and instead document their patterns manually by adding them to `team-patterns.md` after generation.
3. Check `gh auth status` — token may have expired.

---

### Issue 5: Re-runs keep showing the same findings

**Symptoms:**
- Findings you've decided not to fix keep appearing in every report

**Solutions:**

1. After the report, use the acknowledgement step: reply with `[number]:wont-fix` for items you're accepting.
2. Or manually edit `~/.claude/skills/tech-debt-analyzer/findings-state.md` to add the entries.

---

## Integration Points

### With Other Skills

- `cx-code-review` — use after the report to get a deeper review of the highest-impact debt items
- `security-review` — complements the Security/Universal detection with a dedicated security pass

### With Checkmarx Tools

- Checkmarx AST — Tech debt findings can inform which modules need a targeted SAST scan
- Checkmarx SCA — Dependency Debt findings align with SCA's dependency vulnerability scope

---

## Resources & References

### Documentation

- [Claude Code Skills](https://docs.anthropic.com/claude-code) - How skills work in Claude Code
- [cx-agent-skills repository](https://github.com/CheckmarxDev/cx-agent-skills) - Other available skills

### Related Skills

- `cx-code-review` - Code review for specific changes
- `security-review` - Security-focused review of pending branch changes

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-05-05 | Added three analysis modes: full repository, pre-commit (staged files), working tree (uncommitted changes); mode auto-detection from natural language; mode shown in report header; Test Coverage Debt scoped to changed files in pre-commit/working-tree modes; pre-commit trigger phrases added to description and invocation |
| 1.1.0 | 2026-05-05 | Added Step 0 (validation + language detection + self-referential warning); proportional threshold; language-aware subagent prompt templates; exclusion list; partial failure handling; numbered pattern confirmation; findings-state.md persistence; Test Debt split into Coverage and Quality; Fix column in report; effort scale definitions; invocation updated to /tech-debt-analyzer; Standards vs Inconsistencies clarified in analysis step |
| 1.0.0 | 2026-05-05 | Initial release |

---

## Feedback & Support

### Questions?

- 🐛 Report Issues: [GitHub Issues](https://github.com/CheckmarxDev/cx-agent-skills/issues)
- 💬 Discuss: [GitHub Discussions](https://github.com/CheckmarxDev/cx-agent-skills/discussions)

---

## License

This skill is part of cx-agent-skills and is licensed under the MIT License.
