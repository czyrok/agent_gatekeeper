locals {
  name           = "agent-gatekeeper"
  container_port = 4321
  requests_port  = 4322
  data_path      = "/var/lib/agent_gatekeeper"
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
    namespace = var.proxy_namespace_name
  }

  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["list"]
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
    namespace = var.proxy_namespace_name
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

resource "kubernetes_role_v1" "agent_gatekeeper_workspaces" {
  metadata {
    name      = local.name
    namespace = var.workspaces_namespace_name
  }

  rule {
    api_groups = [""]
    resources  = ["pods"]
    verbs      = ["list"]
  }

  depends_on = [ var.wait_for ]
}

resource "kubernetes_role_binding_v1" "agent_gatekeeper_workspaces" {
  metadata {
    name      = local.name
    namespace = var.workspaces_namespace_name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role_v1.agent_gatekeeper_workspaces.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account_v1.agent_gatekeeper.metadata[0].name
    namespace = var.namespace_name
  }
}

resource "kubernetes_secret_v1" "agent_gatekeeper" {
  metadata {
    name      = local.name
    namespace = var.namespace_name
  }

  data = {
    ntfy_token = var.ntfy_token
  }

  depends_on = [ var.wait_for ]
}

## Bound only once its Deployment schedules: the default local-path class is
## WaitForFirstConsumer, so waiting here would deadlock against that pod
resource "kubernetes_persistent_volume_claim_v1" "agent_gatekeeper" {
  wait_until_bound = false

  metadata {
    name      = "${local.name}-data"
    namespace = var.namespace_name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = var.storage_size
      }
    }
  }

  depends_on = [ var.wait_for ]
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

    strategy {
      type = "Recreate"
    }

    template {
      metadata {
        labels = {
          app = local.name
        }

        annotations = {
          secret_hash = sha256(var.ntfy_token)
        }
      }

      spec {
        service_account_name = kubernetes_service_account_v1.agent_gatekeeper.metadata[0].name

        security_context {
          run_as_non_root = true
          run_as_user     = 1000
          run_as_group    = 1000
          fs_group        = 1000

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

          port {
            name           = "requests"
            container_port = local.requests_port
          }

          env {
            name  = "PROXY_NAMESPACE"
            value = var.proxy_namespace_name
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
            name  = "WORKSPACES_NAMESPACE"
            value = var.workspaces_namespace_name
          }

          env {
            name  = "DATABASE_PATH"
            value = "${local.data_path}/gatekeeper.db"
          }

          env {
            name  = "REQUESTS_PORT"
            value = tostring(local.requests_port)
          }

          env {
            name  = "PROXY_URL"
            value = var.proxy_url
          }

          env {
            name  = "PUBLIC_URL"
            value = var.public_url
          }

          env {
            name  = "NTFY_URL"
            value = var.ntfy_url
          }

          env {
            name  = "NTFY_TOPIC"
            value = var.ntfy_topic
          }

          env {
            name = "NTFY_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret_v1.agent_gatekeeper.metadata[0].name
                key  = "ntfy_token"
              }
            }
          }

          env {
            name  = "NOTIFICATION_EMAIL"
            value = var.notification_email
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

          volume_mount {
            name       = "data"
            mount_path = local.data_path
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim_v1.agent_gatekeeper.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [
    var.wait_for,
    kubernetes_role_binding_v1.agent_gatekeeper,
    kubernetes_role_binding_v1.agent_gatekeeper_workspaces
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

resource "kubernetes_service_v1" "agent_gatekeeper_requests" {
  metadata {
    name      = var.requests_service_name
    namespace = var.namespace_name
  }

  spec {
    selector = {
      app = kubernetes_deployment_v1.agent_gatekeeper.metadata[0].labels.app
    }

    port {
      port        = 80
      target_port = local.requests_port
    }

    type = "ClusterIP"
  }
}
