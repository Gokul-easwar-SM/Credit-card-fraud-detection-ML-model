# FraudSentinel frontend
React + TypeScript + Vite, React Three Fiber (landing), Recharts (analytics). Talks to the backend in MANUS_API_INTEGRATION_GUIDE.md.

    cp .env.example .env     # VITE_API_URL (default http://localhost:8000)
    npm install && npm run dev      # http://localhost:5173
    npm run build                   # type-checks, then builds

Routes: `/` landing, `/customer` simulator, `/analyst/login` (seed: analyst / analyst123), `/analyst`, `live`, `queue`, `investigations/:id` (open from queue), `cards`, `analytics`.
No mock data: every number comes from the API. If the backend is down you see an error message, not fake values.
Not built yet: customer profile/history/notifications, drift, audit logs, settings, explainable-AI page, mock adapter, code-splitting.
