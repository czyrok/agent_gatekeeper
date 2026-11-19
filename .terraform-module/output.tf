output "health_checks" {
  value = [
    { name = "Agent gatekeeper", url = "http://${kubernetes_service_v1.agent_gatekeeper.metadata[0].name}.${var.namespace_name}.svc.cluster.local/api/health", conditions = ["[STATUS] == 200"], headers = {}, public = false },
  ]
}

output "homepage_cards" {
  value = [
    { name = "Gatekeeper", href = var.public_url, icon = "/icons/link-gatekeeper.png", description = "Agent egress approvals", public = false },
  ]
}

output "internal_url" {
  value = "http://${kubernetes_service_v1.agent_gatekeeper.metadata[0].name}.${var.namespace_name}.svc.cluster.local"
}

output "public_url" {
  value = var.public_url
}

output "namespace" {
  value = var.namespace_name
}

output "pod_labels" {
  value = { app = local.name }
}

output "port" {
  value = local.container_port
}
