resource "kubernetes_ingress_v1" "agent_gatekeeper" {
  metadata {
    name        = "${local.name}-ingress"
    namespace   = var.namespace_name
    annotations = var.internal_ingress_annotations
  }

  spec {
    ingress_class_name = var.internal_ingress_class_name

    rule {
      host = var.domain

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service_v1.agent_gatekeeper.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
