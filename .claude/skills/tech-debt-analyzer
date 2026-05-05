---
name: tech-debt-analyzer
description: Analyzes team repositories to discover shared patterns, then uses those patterns as a baseline to identify real tech debt in any repository — not arbitrary best practices, but actual divergences from how your team builds software.
metadata:
  author: cx-hugo-machado
  version: "1.0.0"
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

### Expected Outcome

After running this skill you will have:
- A `team-patterns.md` baseline capturing your team's real conventions across all repositories
- A structured tech debt report for the current repository, categorized by type and effort
- A list of cross-repo inconsistencies where no clear team standard has emerged yet

---

## Prerequisites

### Knowledge Required

- Familiarity with your team's repository structure and locations
- Basic understanding of what counts as intentional vs accidental in your codebase

### Tools & Resources

- Claude Code with file read access to your team's repositories
- Absolute paths to all team repositories you want to include in pattern discovery

### Setup Steps

1. Open `skill.md` and fill in the `REPO_PATHS` list in the CONFIGURATION section below with the absolute paths to your team's repositories.
2. Ensure Claude Code has read access to those paths.
3. Run Phase 1 from any working directory — it reads the configured paths directly.

---

## CONFIGURATION

Edit this section before running Phase 1:

```yaml
REPO_PATHS:
  - C:\path\to\team-repo-1
  - C:\path\to\team-repo-2
  - C:\path\to\team-repo-3
```

---

## Instructions

### Phase 1: Team Pattern Discovery

**Goal:** Build a verified baseline of intentional team patterns by scanning all repositories in `REPO_PATHS`.

Run once, or re-run whenever team standards evolve.

**Invoke with:** `"Run tech-debt-analyzer Phase 1"`

1. **Read REPO_PATHS** from the CONFIGURATION section above.

2. **Spawn one subagent per repository** to keep the main context clean. Each subagent scans its repository and extracts:
   - Naming conventions (files, functions, types, variables, packages)
   - Architectural patterns (layering, module boundaries, dependency direction)
   - Shared libraries and how they are used across the codebase
   - Error handling style (sentinel errors, wrapped errors, custom types, panic usage)
   - Logging patterns (library used, log levels, structured vs unstructured)
   - Test structure (unit vs integration split, mock strategy, test file conventions)

3. **Merge findings.** For each pattern dimension, a pattern present in 3 or more repositories is a team pattern. Patterns seen in fewer repos are flagged as inconsistencies.

4. **Write results** to `~/.claude/skills/tech-debt-analyzer/team-patterns.md`:

```markdown
# Team Patterns

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

5. **Stop and show the user the discovered patterns.** Ask:
   > "Do these patterns reflect your team's intentional standards? Reply with any items marked as [NOT A STANDARD] to exclude them before running Phase 2."

6. **Apply exclusions** the user provides and update `team-patterns.md` before finishing.

---

### Phase 2: Tech Debt Analysis

**Goal:** Identify real tech debt in the current repository by comparing it against the team's established patterns.

Phase 2 always targets the **current working directory**. No additional configuration is needed — invoke it from inside the repository you want to analyze.

**Invoke with:** `"Run tech-debt-analyzer Phase 2"`

1. **Check for `team-patterns.md`** at `~/.claude/skills/tech-debt-analyzer/team-patterns.md`.
   - If it does not exist, stop and tell the user:
     > "`team-patterns.md` not found. Please run Phase 1 first to discover your team's patterns."

2. **Load `team-patterns.md`** as the baseline. This defines what is intentional for this team — not debt.

3. **Analyze the current working directory.** Scope all file reads strictly to this directory.

4. **Categorize findings:**

   | Category | Definition |
   |---|---|
   | **Consistency Debt** | Deviates from a confirmed team pattern without justification |
   | **Structural Debt** | Architecture or module boundary degradation |
   | **Dependency Debt** | Outdated, mismatched, or absent dependencies vs team norm |
   | **Test Debt** | Coverage or structure gaps vs team test conventions |

   Also flag universally problematic issues regardless of team patterns: security vulnerabilities, broken dependencies, dead code, unsafe patterns.

5. **Output a structured report:**

```markdown
# Tech Debt Report — [repo name] — [date]

## Summary
- Total findings: N
- Consistency Debt: N
- Structural Debt: N
- Dependency Debt: N
- Test Debt: N

## Top 5 Highest-Impact Items
1. ...

## All Findings

| File:Line | Category | Description | Effort | Also in other repos? |
|---|---|---|---|---|
| path/file.go:42 | Consistency Debt | ... | S/M/L | Yes / No |

## Cross-Repo Notes
Patterns inconsistent across team repos (no clear standard exists yet):
- ...
```

---

## Code Examples

### Example 1: First-time Setup

**Scenario:** Running Phase 1 for the first time on a team with three Go repositories.

**Configuration:**
```yaml
REPO_PATHS:
  - C:\Workspaces\GO\auth-service
  - C:\Workspaces\GO\inventory-service
  - C:\Workspaces\GO\notifications-service
```

**Invocation:**
```
Run tech-debt-analyzer Phase 1
```

**Expected output:** Claude spawns three subagents, merges findings, writes `team-patterns.md`, then pauses and presents the patterns for your review before writing the final file.

---

### Example 2: Analyzing a Repository

**Scenario:** Running Phase 2 on `inventory-service` after Phase 1 has completed.

```bash
cd C:\Workspaces\GO\inventory-service
# then in Claude Code:
```
```
Run tech-debt-analyzer Phase 2
```

**Expected Output:**
```
# Tech Debt Report — inventory-service — 2026-05-05

## Summary
- Total findings: 12
- Consistency Debt: 5
- Structural Debt: 3
- Dependency Debt: 2
- Test Debt: 2

## Top 5 Highest-Impact Items
1. ...
```

**Explanation:**
- Only deviations from `team-patterns.md` are flagged as Consistency Debt
- Universally problematic issues are flagged regardless of team patterns
- Each finding includes a file:line reference and S/M/L effort estimate

---

## Best Practices

### Do:

- [ ] Run Phase 1 across all active team repositories, not just a subset
- [ ] Review the discovered patterns carefully — mark anything that is not an intentional standard as `[NOT A STANDARD]`
- [ ] Re-run Phase 1 periodically as your team's conventions evolve
- [ ] Run Phase 2 from the repository root for complete coverage
- [ ] Use the effort estimates (S/M/L) to prioritize which debt to tackle first
- [ ] Share `team-patterns.md` with the team to make implicit standards explicit

### Don't:

- [ ] Skip Phase 1 — analyzing debt without a team baseline produces generic, noisy results
- [ ] Include experimental or prototype repositories in REPO_PATHS — they skew the pattern baseline
- [ ] Treat every finding as mandatory — Consistency Debt is context-dependent; use judgement
- [ ] Hardcode a target repository — Phase 2 always uses the current working directory
- [ ] Modify files inside any repository during analysis — this skill is read-only

---

## Common Issues & Troubleshooting

### Issue 1: Phase 2 reports "team-patterns.md not found"

**Symptoms:**
- Phase 2 stops immediately with a missing file error

**Root Causes:**
- Phase 1 has not been run yet
- Phase 1 was interrupted before writing the output file

**Solutions:**

1. **Run Phase 1 first:**
   ```
   Run tech-debt-analyzer Phase 1
   ```

2. **Verify the file was written:**
   Check that `~/.claude/skills/tech-debt-analyzer/team-patterns.md` exists after Phase 1 completes.

**Prevention:**
Always complete Phase 1 including the user confirmation step before invoking Phase 2.

---

### Issue 2: Pattern baseline is too noisy — too many things flagged as NOT A STANDARD

**Symptoms:**
- Phase 1 produces a long list of patterns that don't feel intentional
- The team-patterns.md baseline includes one-off implementation details

**Root Causes:**
- REPO_PATHS includes prototype or experimental repositories
- The 3-repo threshold is catching coincidental similarities

**Solutions:**

1. **Remove non-representative repositories** from REPO_PATHS and re-run Phase 1.
2. **Use the review step** to mark noisy entries as `[NOT A STANDARD]` — Phase 1 will exclude them before writing the final baseline.

---

### Issue 3: Phase 2 flags team patterns as debt

**Symptoms:**
- Findings include things your team does intentionally and consistently

**Root Causes:**
- The team-patterns.md baseline is incomplete or was not confirmed by the user
- The pattern appears in fewer than 3 repos so was not captured as a team standard

**Solutions:**

1. **Re-run Phase 1** and add the missing pattern manually during the review step.
2. **Add more repositories to REPO_PATHS** to give Phase 1 broader coverage.

---

## Integration Points

### With Other Skills

- `cx-code-review` — use after Phase 2 to get a deeper review of the highest-impact debt items
- `security-review` — complements Phase 2's universal issue detection with a dedicated security pass

### With Checkmarx Tools

- Checkmarx AST — Tech debt findings can inform which modules need a targeted SAST scan
- Checkmarx SCA — Dependency Debt findings from Phase 2 align with SCA's dependency vulnerability scope

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
| 1.0.0 | 2026-05-05 | Initial release |

---

## Feedback & Support

### Questions?

- 🐛 Report Issues: [GitHub Issues](https://github.com/CheckmarxDev/cx-agent-skills/issues)
- 💬 Discuss: [GitHub Discussions](https://github.com/CheckmarxDev/cx-agent-skills/discussions)

---

## License

This skill is part of cx-agent-skills and is licensed under the MIT License.
