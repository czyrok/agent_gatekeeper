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

resource "kubernetes_network_policy_v1" "agent_gatekeeper_ingress" {
  metadata {
    name      = "agent-gatekeeper-ingress"
    namespace = var.namespace_name
  }

  spec {
    pod_selector {
      match_labels = {
        app = local.name
      }
    }

    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = var.ingress_namespace_name
          }
        }

        pod_selector {
          match_labels = var.ingress_pod_labels
        }
      }

      ports {
        port     = tostring(local.container_port)
        protocol = "TCP"
      }
    }

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = var.workspaces_namespace_name
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
