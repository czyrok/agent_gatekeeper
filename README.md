# agent_gatekeeper

Approve the hosts agent workspaces may reach: lists what the egress proxy
refused and allowlists it in one click.

The page reads the `egress-proxy` pod logs of the last 24 h, lists every host
the proxy refused that is not yet allowed, and appends `^host\.tld$` to the
`egress-allowlist` ConfigMap on **Allow**. The proxy reloads within a minute.

## Develop

```bash
bun install
bun run dev
```

The API calls the Kubernetes API with the pod's ServiceAccount token, so
outside the cluster only the UI renders and both lists report an error.

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

The Terraform module in `.terraform-module/` sets all five.

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
