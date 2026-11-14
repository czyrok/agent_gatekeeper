resource "kubernetes_network_policy_v1" "workspaces_to_agent_gatekeeper" {
  metadata {
    name      = "workspaces-to-agent-gatekeeper"
    namespace = var.workspaces_namespace_name
  }

  spec {
    pod_selector {}

    policy_types = ["Egress"]

    egress {
      to {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = var.namespace_name
          }
        }

        pod_selector {
          match_labels = {
            app = local.name
          }
        }
      }

      ports {
        port     = tostring(local.requests_port)
        protocol = "TCP"
      }
    }
  }

  depends_on = [ var.wait_for ]
}
