# Security Policy

- MongoDB credentials and all authentication secrets belong only in server-side environment variables. Never use `VITE_`, `REACT_APP_`, or `NEXT_PUBLIC_` prefixes for secrets, commit `.env` files, or log credentials, passwords, cookies, or raw session tokens.
- Accounts and student cards use MongoDB. Supabase is reserved for the existing anonymous comments and replies; do not add Supabase Auth, move comments, or create Storage buckets as part of this work.
- Roles and ownership must be derived from a verified server-side session. Public signup can create only `member` accounts; student/admin accounts and card ownership are provisioned through trusted admin tooling. Members cannot self-edit account data; they may only complete a password rotation explicitly required after an admin-issued temporary password.
- Hash passwords and stored session tokens. Validate request schemas and database identifiers, enforce body limits, CSRF/origin checks, rate limits, least-privilege queries, and allowlisted response fields.
- Render user-provided text as text. Validate external URLs and never return stack traces or database details to clients.
- Do not migrate production data, create real accounts, add production secrets, or deploy to production without explicit approval. Use an isolated development/preview database.
- Report suspected vulnerabilities privately to the project maintainers; do not include credentials or personal data in reports.
