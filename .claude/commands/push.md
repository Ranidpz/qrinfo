---
description: Security check, update documentation, commit all changes, and push to main
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git check-ignore:*), Bash(git remote:*), Bash(git remote add:*), Bash(git init:*), Bash(cat:*), Bash(grep:*), Bash(find:*), Read, Edit, Write, Glob, Grep, AskUserQuestion
---

# Secure Push to Main

Perform security audit, update documentation, and push to main branch safely.

## FIRST: Check Git Repository Setup

Before anything else, check if git and remote are configured:

### 1. Check if git is initialized
Run `git status` to check if this is a git repository.
If NOT initialized, run `git init` first.

### 2. Check if remote repository exists
Run `git remote -v` to see if there's a remote configured.

If NO remote is configured:
- Use AskUserQuestion to ask the user: "No remote repository configured. Please provide your GitHub repository URL (e.g., https://github.com/username/repo.git)"
- Once the user provides the URL, run: `git remote add origin <URL>`
- Confirm: "Remote repository set to: <URL>. This will be used for all future pushes in this project."

If remote EXISTS:
- Show the user which remote will be used
- Continue with security checks

## CRITICAL: Security Checks First

Before ANY commit, perform these security checks:

### 1. Check .gitignore exists and is complete
Read the .gitignore file and verify it includes:
- `.env` and `.env.*` (all environment files)
- `.env.local`, `.env.production`, `.env.development`
- `*.pem`, `*.key` (private keys)
- `*-credentials.json`, `*-adminsdk-*.json` (Firebase/GCP credentials)
- `node_modules/`
- `.next/`, `dist/`, `build/`
- `*.log`
- `.DS_Store`

If any are missing, ADD them to .gitignore before proceeding!

### 2. Scan for exposed secrets
Search the codebase for potential security issues:
- API keys hardcoded in source files (not in .env)
- Firebase config with sensitive data exposed
- Private keys or credentials in code
- Passwords or tokens in plain text
- Check files being staged don't contain secrets

Use grep to search for patterns like:
- `apiKey.*=.*["']` in non-.env files
- `password.*=.*["']`
- `secret.*=.*["']`
- `token.*=.*["']`
- `private_key`
- `-----BEGIN.*PRIVATE`

### 3. Verify sensitive files are git-ignored
Run `git check-ignore` on:
- `.env.local`
- `.env`
- Any `*.json` credential files
- Any `*.pem` or `*.key` files

If ANY sensitive file is NOT ignored, STOP and fix .gitignore first!

### 4. Review staged files for security
Run `git diff --cached` and check:
- No API keys in the diff
- No credentials exposed
- No private tokens visible
- Environment variables are properly referenced (process.env.X)

### 5. Check for OWASP vulnerabilities
Review recent code changes for:
- SQL injection risks
- XSS vulnerabilities (unsanitized user input in HTML)
- Command injection (user input in shell commands)
- Insecure authentication
- Exposed error messages with sensitive info

## Security Report

After all checks, provide a security report:
```
SECURITY AUDIT REPORT
=====================
.gitignore status: OK / NEEDS UPDATE
Exposed secrets found: YES (list) / NO
Sensitive files protected: YES / NO
OWASP issues found: YES (list) / NO

SAFE TO PUSH: YES / NO
```

ONLY proceed if SAFE TO PUSH is YES!

## Documentation Update Steps

After security passes:

1. Run `git status` and `git diff` to see all changes made
2. Analyze what was changed/added/removed in the code
3. Update relevant MD files if needed:
   - Update CHANGELOG.md with the new changes (add entry at top)
   - Update README.md if new features were added
   - Update version in package.json if significant changes
4. Create a descriptive commit message based on the changes

## Commit and Push

5. Stage all files with `git add .`
6. Commit with a proper conventional commit message (feat/fix/docs/refactor)
7. Push to main branch with `git push origin main`

## Commit message format

Use conventional commits:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation only
- `refactor:` for code refactoring
- `style:` for formatting changes
- `security:` for security fixes

Include version bump in commit message if package.json version changed.

## Final Confirmation

After push, confirm:
- "Push completed successfully"
- "No security issues detected"
- Summary of what was pushed

Please start with the security audit now.
