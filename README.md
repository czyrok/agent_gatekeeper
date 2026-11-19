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

The page lists requests for 24 h after their decision, denied and expired ones
included: a denied request can still be allowed, and a stalled one retried.

The caller is the running pod whose IP is the TCP peer, read in
`WORKSPACES_NAMESPACE`; its `coder.workspace_owner` and `coder.workspace_name`
labels name the workspace. Any other caller gets `403` with the address the
gatekeeper saw, also logged; so does any request carrying `X-Forwarded-For`.

Requests live in SQLite at `DATABASE_PATH` and survive a restart.

## Develop

`nix develop` gives `bun` and `node`; Coder agent workspaces load the same
shell, as `.#agent`, on start.

```bash
bun install
DATABASE_PATH=./gatekeeper.db bun run dev
```

`DATABASE_PATH` defaults to `gatekeeper.db` in the working directory.
`bun run start` runs `server.mjs`: the app on `PORT`, only `/mcp` on
`REQUESTS_PORT`.

The API calls the Kubernetes API with the pod's ServiceAccount token, so
outside the cluster only the UI renders and every list reports an error.

`bun run check` type-checks, `bun run build` builds the server into `dist/`.

## Build and push

A push to `main` runs `.github/workflows/image-to-registry.yaml`, which
pushes `lyre/agent_gatekeeper:latest-amd64` and `latest-arm64` to the S3-backed
registry; `gh workflow run image-to-registry.yaml` runs it by hand. It needs
an environment `release` holding the secrets
`DOCKER_IMAGE_REGISTRY_BUCKET_REGION`, `DOCKER_IMAGE_REGISTRY_BUCKET_NAME`,
`DOCKER_IMAGE_REGISTRY_BUCKET_ACCESS_KEY_ID` and
`DOCKER_IMAGE_REGISTRY_BUCKET_ACCESS_KEY_SECRET`, the same values as
`lyre_web`'s. Keel then rolls the Deployment, as below.

By hand, from the lyre devShell, with the local registry proxy running:

```bash
cargo make registry-image
```

This pushes `localhost:60471/lyre/agent_gatekeeper:latest-amd64`. Keel polls
that tag every minute and rolls the Deployment when its digest changes;
`kubectl -n coder rollout restart deployment agent-gatekeeper` skips the wait.
`cargo make local-image` builds the same image into the local Docker store.

## Environment

| Variable | Value |
| --- | --- |
| `PROXY_NAMESPACE` | Namespace of the egress proxy and its allowlist, `coder-egress` |
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

The Terraform module in `.terraform-module/` sets all of them. Its
ServiceAccount's Role on pods, pod logs and the allowlist lives in
`proxy_namespace_name`, not in the gatekeeper's own namespace. A NetworkPolicy
admits only the ingress controller pods (`ingress_namespace_name`,
`ingress_pod_labels`) and the health checker's namespace
(`health_check_namespace_name`) on 4321, and only workspace pods on 4322.
The agent control plane's module adds its own policy admitting its pods on
4321, to read `/api/requests` for Homepage's Waiting card.

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
