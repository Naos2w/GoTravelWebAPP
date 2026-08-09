---
applyTo: "**"
---
# Skill Mapping: git-commit-format

## Commit Message Format
Use the Conventional Commits specification:
```text
<type>(<scope>): <description>
```

### Common Types:
- `feat`: new features (e.g. adding a filter, map markers)
- `fix`: bug fixes (e.g. resolving dropdown clipping, fixing date parsing)
- `docs`: documentation updates
- `style`: formatting, styling adjustments (Tailwind updates)
- `refactor`: code restructuring without changing behavior
- `test`: adding or updating tests
- `chore`: dependency updates, workflow configuration

## Required Checks Before Commit
Always run these checks to verify code integrity:
```bash
npm run type-check
npm run build
```

## PR Naming & Description Rule
- **PR Title**: Use format `Naos/xxx`, where `xxx` is a kebab-case English summary of the primary change.
- **PR Description**: Must describe the entire delta against the target branch (e.g. `develop` or `main`), detailing:
  - Purpose of changes
  - Key modifications
  - Any potential impact or risks
  - Validation steps performed

## Merge Strategy
- **Feature PRs**: Must use **Squash and merge** to keep the mainline history clean.
- **Integration PRs**: Between long-lived branches (e.g. `develop` -> `main`), use a regular merge commit to maintain release context.
