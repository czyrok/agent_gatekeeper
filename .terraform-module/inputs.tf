variable "namespace_name" {
  type        = string
  description = "Namespace where Agent Gatekeeper runs"
}

variable "local_docker_registry_host" {
  type        = string
  description = "Host of the local Docker registry"
}

variable "domain" {
  type        = string
  description = "Hostname the page is served on"
}

variable "internal_ingress_annotations" {
  type        = map(string)
  description = "Annotations of the NetBird-only ingresses"
}

variable "internal_ingress_class_name" {
  type        = string
  description = "Ingress class of the internal Traefik"
}

variable "ingress_namespace_name" {
  type        = string
  description = "Namespace of the ingress controller allowed to reach the page"
}

variable "ingress_pod_labels" {
  type        = map(string)
  description = "Labels of the ingress controller pods allowed to reach the page"
}

variable "proxy_namespace_name" {
  type        = string
  description = "Namespace of the egress proxy and its allowlist ConfigMap; the gatekeeper's Role lives there"
}

variable "proxy_pod_selector" {
  type        = string
  description = "Label selector of the egress proxy pods, e.g. app=egress-proxy"
}

variable "allowlist_config_map_name" {
  type        = string
  description = "ConfigMap holding the egress proxy allowlist"
}

variable "allowlist_key" {
  type        = string
  default     = "proxy-allowlist"
  description = "Data key of the allowlist in that ConfigMap"
}

variable "workspaces_namespace_name" {
  type        = string
  description = "Namespace of the agent workspaces, whose pods may call the requests port"
}

variable "requests_service_name" {
  type        = string
  description = "Name of the Service exposing the MCP endpoint to workspaces"
}

variable "proxy_url" {
  type        = string
  description = "URL of the egress proxy, probed to confirm an approved host gets through"
}

variable "public_url" {
  type        = string
  description = "URL the operator opens the page on, used in notification links"
}

variable "ntfy_url" {
  type        = string
  description = "URL of the ntfy server notifications are published to"
}

variable "ntfy_topic" {
  type        = string
  description = "ntfy topic of the egress requests"
}

variable "ntfy_token" {
  type        = string
  sensitive   = true
  description = "ntfy access token allowed to publish on that topic"
}

variable "notification_email" {
  type        = string
  default     = ""
  description = "Address ntfy also emails each notification to. Empty sends no email"
}

variable "control_plane_url" {
  type        = string
  default     = ""
  description = "Internal URL of the agent control plane; empty leaves ask_operator answering unlinked"
}

variable "storage_size" {
  type        = string
  default     = "256Mi"
  description = "Size of the volume holding the requests database"
}

variable "wait_for" {
  type        = list(string)
  default     = []
  description = "Identifiers of the steps this module must wait for"
}
