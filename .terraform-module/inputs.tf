variable "namespace_name" {
  type        = string
  description = "Namespace where Agent Gatekeeper runs, the same as the egress proxy's"
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

variable "wait_for" {
  type        = list(string)
  default     = []
  description = "Identifiers of the steps this module must wait for"
}
