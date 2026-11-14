locals {
  name           = "agent-gatekeeper"
  container_port = 4321
}

resource "kubernetes_service_account_v1" "agent_gatekeeper" {
  metadata {
    name      = local.name
    namespace = var.namespace_name
  }

  depends_on = [ var.wait_for ]
}

resource "kubernetes_role_v1" "agent_gatekeeper" {
  metadata {
    name      = local.name
    namespace = var.namespace_name
  }

  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["get", "list"]
  }

  rule {
    api_groups = [""]
    resources  = ["pods/log"]
    verbs      = ["get"]
  }

  rule {
    api_groups     = [""]
    resources      = ["configmaps"]
    resource_names = [var.allowlist_config_map_name]
    verbs          = ["get", "update"]
  }

  depends_on = [ var.wait_for ]
}

resource "kubernetes_role_binding_v1" "agent_gatekeeper" {
  metadata {
    name      = local.name
    namespace = var.namespace_name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.agent_gatekeeper.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.agent_gatekeeper.metadata[0].name
    namespace = var.namespace_name
  }
}

resource "kubernetes_deployment_v1" "agent_gatekeeper" {
  metadata {
    name      = local.name
    namespace = var.namespace_name

    labels = {
      app = local.name
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.name
      }
    }

    template {
      metadata {
        labels = {
          app = local.name
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.agent_gatekeeper.metadata[0].name

        security_context {
          run_as_non_root = true
          run_as_user     = 1000
          run_as_group    = 1000

          seccomp_profile {
            type = "RuntimeDefault"
          }
        }

        container {
          image             = "${var.local_docker_registry_host}/lyre/agent_gatekeeper:latest-amd64"
          image_pull_policy = "Always"
          name              = local.name

          port {
            container_port = local.container_port
          }

          env {
            name  = "PROXY_NAMESPACE"
            value = var.namespace_name
          }

          env {
            name  = "PROXY_POD_SELECTOR"
            value = var.proxy_pod_selector
          }

          env {
            name  = "ALLOWLIST_CONFIG_MAP"
            value = var.allowlist_config_map_name
          }

          env {
            name  = "ALLOWLIST_KEY"
            value = var.allowlist_key
          }

          env {
            name  = "NODE_EXTRA_CA_CERTS"
            value = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
          }

          security_context {
            allow_privilege_escalation = false
            read_only_root_filesystem  = true

            capabilities {
              drop = ["ALL"]
            }
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = local.container_port
            }

            period_seconds = 10
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = local.container_port
            }

            period_seconds    = 30
            failure_threshold = 3
          }
        }
      }
    }
  }

  depends_on = [
    var.wait_for,
    kubernetes_role_binding_v1.agent_gatekeeper
  ]
}

resource "kubernetes_service_v1" "agent_gatekeeper" {
  metadata {
    name      = local.name
    namespace = var.namespace_name
  }

  spec {
    selector = {
      app = kubernetes_deployment_v1.agent_gatekeeper.metadata[0].labels.app
    }

    port {
      port        = 80
      target_port = local.container_port
    }

    type = "ClusterIP"
  }
}
