# FRANK uptime monitor

Every 10 minutes GitHub pings the two Render services (and flutek.com). A failed
step sends a GitHub notification email to the repository owner.

- agent   https://flutek-agent.onrender.com/healthz
- agent   https://flutek-agent.onrender.com/api/health
- inbox   https://flutek-inbox.onrender.com/healthz
- inbox   https://flutek-inbox.onrender.com/api/health
- site    https://flutek.com/

Run manually: Actions -> uptime -> Run workflow.

Why a public repo: scheduled workflows on private personal repositories are
known not to fire (GitHub community discussions 201354, 209525, 209896). The
endpoints are public, so nothing is exposed here.
