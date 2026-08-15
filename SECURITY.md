# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities. Instead,
report privately so it can be handled without exposing users to risk.

You can reach the maintainers at the GitHub private vulnerability reporting
flow for this repository:

> GitHub → this repo → **Security** tab → **Report a vulnerability**

Or, if that's unavailable, open a private issue and tag it `security` (a
maintainer will reach out to coordinate a private disclosure).

## Expectations

- You'll receive an acknowledgment within a few days.
- We'll assess severity and impact, and coordinate a fix.
- We ask that you do not publicly disclose a vulnerability until a fix is
  released (or 90 days after reporting, whichever is sooner).

## Scope

This project is a fully client-side, offline tool. The main surface area is the
parsing of untrusted archive/JSON data that users import. Input-parsing bugs that
could cause crashes, hangs, or memory issues in a browser are in scope. Since all
processing happens locally, there is no server-side data to compromise.

## Safe use

- Only import files you trust (like any archive reader, treat suspicious zips
  with caution).
- Keep dependencies updated via `npm audit`.
