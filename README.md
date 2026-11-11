11# 6Native Tailor

A responsive storefront and API foundation for an Abuja fashion and tailoring house.

## What is included

- React + TypeScript multi-page storefront with dedicated shop, custom-tailoring, style-advice, atelier, customer-care, fit-guide, FAQ, and policy pages.
- Custom-order form with measurement fields and private, in-browser reference-image previews.
- Refined 6Native monogram and brand lockup.
- Abuja location details, Nigerian fashion imagery, and a persistent light/dark theme switch.
- FastAPI health and sample catalog endpoints.
- A single-admin image library for homepage hero slides, product images, and storefront galleries.
- Customer email/password registration, sign-in, and profile access.
- Responsive layouts, keyboard-friendly controls, and reduced-motion support.

The custom-order form only opens WhatsApp after you configure the business number; it does not upload or persist measurements or images. Reference images must be attached by the customer in WhatsApp. AI styling is an unconnected interface with clearly labeled editorial inspiration, not generated AI advice. Customer-service WhatsApp chat also needs the business number. Checkout, order history/tracking, durable customer support tickets/chat, and production workflows are not implemented yet. Admin sign-in is separate and only protects image management.

## Requirements

- Node.js 20+
- Python 3.11+

## Run locally

In the repository root, install the frontend dependencies and start Vite:

```bash
npm install
npm run dev
```

In another terminal, install and start the API:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ./backend
uvicorn app.main:app --app-dir backend --reload --port 8000
```

Open the frontend URL printed by Vite (normally http://localhost:5173). The API documentation is available at http://127.0.0.1:8000/docs, with health and sample product endpoints at `/api/health` and `/api/products`.

To enable WhatsApp links, copy `.env.example` to `.env.local` and set `VITE_WHATSAPP_NUMBER` to the official business number in international format without `+`, spaces, or punctuation. Restart Vite after changing it. Never place private AI or payment credentials in a `VITE_` variable; those must be configured on a server.

## Customer accounts

Customers can register and sign in at `/account`. The API stores only a name, normalized email, and Argon2 password hash; sign-in uses an HTTP-only session cookie. Set `CUSTOMER_SESSION_SECRET` to a random secret of at least 32 characters. For local HTTP development, keep `CUSTOMER_COOKIE_SECURE=false`; set it to `true` behind HTTPS. Accounts use a local SQLite database by default (`backend/customers.sqlite3`). Set `DATABASE_URL` to a persistent PostgreSQL database for production; serverless local filesystems are not durable. Email verification and password recovery are not included yet. Accounts currently provide a profile only; order requests still go through WhatsApp.

## Admin image management

The admin page is available at `/admin`. The API refuses admin access until the server has an admin email, a `pwdlib` password hash, and a session-signing secret configured. Generate the hash and secret in the backend environment:

```bash
python -c 'from pwdlib import PasswordHash; print(PasswordHash.recommended().hash(input("Admin password: ")))'
python -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Set the resulting values as `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` in the backend's environment only. For local HTTP development, set `ADMIN_COOKIE_SECURE=false`; keep it `true` behind HTTPS. Set `CORS_ORIGINS` to the exact frontend origins, comma-separated, and set `VITE_API_URL` only when the frontend and API are hosted separately. The API re-encodes accepted JPEG, PNG, and WEBP uploads as WEBP, limits uploads to 10 MB, and stores them under `MEDIA_DIRECTORY` (default: `backend/media`).

Uploaded product and hero images replace the corresponding storefront image; removing the upload restores its shipped default. Gallery uploads are additional images. The default local filesystem directory is ignored by git. Production hosting must provide persistent storage for `MEDIA_DIRECTORY`, or uploads will not survive redeployments.

The storefront imagery in `public/images` was supplied for this project.
