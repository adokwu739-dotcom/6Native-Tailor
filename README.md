11# 6Native Tailor

A responsive storefront and API foundation for an Abuja fashion and tailoring house.

## What is included

- React + TypeScript multi-page storefront with dedicated shop, custom-tailoring, style-advice, atelier, customer-care, fit-guide, FAQ, and policy pages.
- Custom-order form with measurement fields and private, in-browser reference-image previews.
- Refined 6Native monogram and brand lockup.
- Abuja location details, Nigerian fashion imagery, and a persistent light/dark theme switch.
- FastAPI health and sample catalog endpoints.
- Responsive layouts, keyboard-friendly controls, and reduced-motion support.

The custom-order form only opens WhatsApp after you configure the business number; it does not upload or persist measurements or images. Reference images must be attached by the customer in WhatsApp. AI styling is an unconnected interface with clearly labeled editorial inspiration, not generated AI advice. Customer-service WhatsApp chat also needs the business number. Checkout, authentication, durable customer support tickets/chat, order management, and production workflows are not implemented yet.

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

The storefront imagery in `public/images` was supplied for this project.
