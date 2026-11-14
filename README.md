# agent_gatekeeper

Approve the hosts agent workspaces may reach: lists what the egress proxy
refused and allowlists it in one click.

The page reads the `egress-proxy` pod logs of the last 24 h, lists every host
the proxy refused that is not yet allowed, and appends `^host\.tld$` to the
`egress-allowlist` ConfigMap on **Allow**. The proxy reloads within a minute.

## Agent requests

Workspaces reach an MCP endpoint at
`http://agent-gatekeeper-requests.coder.svc.cluster.local/mcp` (the requests
Service, port 4322; the page's port 4321 stays out of their reach). It offers
two tools:

- `request_egress { host, reason }` stores the request, publishes it to ntfy
  with a link to `/?request=<id>`, and waits up to 25 s for a decision.
- `egress_status { host }` waits up to 25 s more on the same request.

Each answers `pending`, `approved` (proxy not reloaded yet), `allowed` (the
proxy lets the host through), `stalled` (still refused 3 min after approval),
`denied` or `expired` (unanswered for an hour). A denial blocks the same host
for that workspace for an hour.

The caller is the running pod whose IP is the TCP peer, read in
`WORKSPACES_NAMESPACE`; its `coder.workspace_owner` and `coder.workspace_name`
labels name the workspace. Any other caller gets `403`.

Requests live in SQLite at `DATABASE_PATH` and survive a restart.

## Develop

```bash
bun install
DATABASE_PATH=./gatekeeper.db bun run dev
```

`DATABASE_PATH` must be set, or the allowlist and request endpoints fail.
`bun run start` runs `server.mjs`: the app on `PORT`, only `/mcp` on
`REQUESTS_PORT`.

The API calls the Kubernetes API with the pod's ServiceAccount token, so
outside the cluster only the UI renders and every list reports an error.

`bun run check` type-checks, `bun run build` builds the server into `dist/`.

## Build and push

From the lyre devShell, with the local registry proxy running:

```bash
cargo make registry-image
kubectl -n coder rollout restart deployment agent-gatekeeper
```

This pushes `localhost:60471/lyre/agent_gatekeeper:latest-amd64`. The
Deployment pulls that tag with `Always`, so a new image only lands on restart.
`cargo make local-image` builds the same image into the local Docker store.

## Environment

| Variable | Value |
| --- | --- |
| `PROXY_NAMESPACE` | Namespace of the egress proxy and its allowlist |
| `PROXY_POD_SELECTOR` | Label selector of the proxy pods, `app=egress-proxy` |
| `ALLOWLIST_CONFIG_MAP` | Allowlist ConfigMap, `egress-allowlist` |
| `ALLOWLIST_KEY` | Its data key, `proxy-allowlist` |
| `NODE_EXTRA_CA_CERTS` | The ServiceAccount `ca.crt`, to trust the API server |
| `WORKSPACES_NAMESPACE` | Namespace of the workspace pods allowed on `/mcp` |
| `DATABASE_PATH` | SQLite file of the requests, on the data volume |
| `REQUESTS_PORT` | Port serving only `/mcp`, `4322` |
| `PROXY_URL` | Egress proxy URL, probed after an approval |
| `PUBLIC_URL` | Page URL used in notification links |
| `NTFY_URL` | ntfy server notifications are published to |
| `NTFY_TOPIC` | Its topic, `egress-requests` |
| `NTFY_TOKEN` | ntfy token allowed to publish there |
| `NOTIFICATION_EMAIL` | Address ntfy also emails; empty sends none |

The Terraform module in `.terraform-module/` sets all of them.

## Theme

[neobrutalism.dev](https://www.neobrutalism.dev), blue palette
(`https://neobrutalism.dev/r/styling/blue.json`) written into
`src/styles/global.css`, with the site's default font, DM Sans, bundled from
`@fontsource-variable/dm-sans`. Add a component with:

```bash
bunx shadcn@4.23.0 add https://www.neobrutalism.dev/r/<name>.json
```

## License

MIT, see `LICENSE`.
