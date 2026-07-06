# ClipCut Test Credentials

## Admin
- Email: `admin@clipcut.app`
- Password: `Admin@12345`
- Role: `admin`
- Plan: `studio`

## Test User (create via UI/API)
- Register any email/password via POST `/api/auth/register` or `/register` route.
- Suggested: `creator@clipcut.app` / `Creator@12345`

## Auth Endpoints
- POST `/api/auth/register` - body: `{email, password, name?}` (sets httpOnly cookies)
- POST `/api/auth/login` - body: `{email, password}` (sets httpOnly cookies)
- POST `/api/auth/logout`
- GET  `/api/auth/me`

## Project Endpoints
- GET  `/api/projects` (list)
- POST `/api/projects/upload` (multipart: file, name, subtitle_style, accent_color, font, quality)
- GET  `/api/projects/{id}`
- GET  `/api/projects/{id}/thumbnail`
- GET  `/api/projects/{id}/download`
- GET  `/api/projects/{id}/video`

## Plans / Billing
- GET  `/api/plans`
- POST `/api/billing/upgrade` - body: `{plan}`
