locals {
  backend_url = "http://ca-${var.project}-backend-${var.environment}.${azurerm_container_app_environment.main.default_domain}"

  agents = {
    "risk-assessment"  = { port = 7071, module = "risk_assessment.agent" }
    "recommendation"   = { port = 7072, module = "recommendation.agent" }
    "exception-triage" = { port = 7073, module = "exception_triage.agent" }
    "rationale"        = { port = 7074, module = "rationale.agent" }
    "insights"         = { port = 7075, module = "insights.agent" }
    "notification"     = { port = 7076, module = "notification.agent" }
  }

  agent_fqdns = {
    for key, val in local.agents :
    key => "https://ca-${var.project}-${key}-${var.environment}.${azurerm_container_app_environment.main.default_domain}"
  }

  mcp_server_url = "https://ca-${var.project}-mcp-server-${var.environment}.${azurerm_container_app_environment.main.default_domain}/sse"

  env_var_map = {
    "risk-assessment"  = "RISK_AGENT_URL"
    "recommendation"   = "RECOMMENDATION_AGENT_URL"
    "exception-triage" = "TRIAGE_AGENT_URL"
    "rationale"        = "RATIONALE_AGENT_URL"
    "insights"         = "INSIGHTS_AGENT_URL"
    "notification"     = "NOTIFICATION_AGENT_URL"
  }
}

resource "azurerm_container_app_environment" "main" {
  name                = "cae-${var.project}-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = {
    project     = var.project
    environment = var.environment
  }
}

resource "azurerm_user_assigned_identity" "agents" {
  name                = "id-${var.project}-agents-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
}

resource "azurerm_role_assignment" "agents_acr_pull" {
  principal_id                     = azurerm_user_assigned_identity.agents.principal_id
  role_definition_name             = "AcrPull"
  scope                            = var.acr_id
  skip_service_principal_aad_check = true
}

resource "azurerm_container_app" "agents" {
  for_each = local.agents

  name                         = "ca-${var.project}-${each.key}-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.agents.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.agents.id
  }

  secret {
    name  = "cosmos-key"
    value = var.cosmos_key
  }

  secret {
    name  = "openai-key"
    value = var.openai_key
  }

  ingress {
    external_enabled = true
    target_port      = each.value.port
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0
    max_replicas = 3

    container {
      name   = each.key
      image  = "${var.acr_login_server}/${var.project}-agent-${each.key}:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "AGENT_MODULE"
        value = each.value.module
      }

      env {
        name  = "AGENT_PORT"
        value = tostring(each.value.port)
      }

      env {
        name  = "COSMOS_ENDPOINT"
        value = var.cosmos_endpoint
      }

      env {
        name        = "COSMOS_KEY"
        secret_name = "cosmos-key"
      }

      env {
        name  = "COSMOS_DATABASE"
        value = var.cosmos_database
      }

      env {
        name  = "AZURE_OPENAI_ENDPOINT"
        value = var.openai_endpoint
      }

      env {
        name        = "AZURE_OPENAI_KEY"
        secret_name = "openai-key"
      }

      env {
        name  = "AZURE_OPENAI_DEPLOYMENT"
        value = var.openai_deployment
      }

      env {
        name  = "AZURE_OPENAI_API_VERSION"
        value = "2024-12-01-preview"
      }

      env {
        name  = "RISK_AGENT_URL"
        value = local.agent_fqdns["risk-assessment"]
      }

      env {
        name  = "RECOMMENDATION_AGENT_URL"
        value = local.agent_fqdns["recommendation"]
      }

      env {
        name  = "TRIAGE_AGENT_URL"
        value = local.agent_fqdns["exception-triage"]
      }

      env {
        name  = "RATIONALE_AGENT_URL"
        value = local.agent_fqdns["rationale"]
      }

      env {
        name  = "INSIGHTS_AGENT_URL"
        value = local.agent_fqdns["insights"]
      }

      env {
        name  = "NOTIFICATION_AGENT_URL"
        value = local.agent_fqdns["notification"]
      }

      env {
        name  = "MCP_SERVER_URL"
        value = local.mcp_server_url
      }

      liveness_probe {
        transport = "HTTP"
        port      = each.value.port
        path      = "/health"
      }

      readiness_probe {
        transport = "HTTP"
        port      = each.value.port
        path      = "/health"
      }
    }
  }

  tags = {
    project     = var.project
    environment = var.environment
    agent       = each.key
  }
}

resource "azurerm_container_app" "mcp_server" {
  name                         = "ca-${var.project}-mcp-server-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.agents.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.agents.id
  }

  secret {
    name  = "cosmos-key"
    value = var.cosmos_key
  }

  ingress {
    external_enabled = false
    target_port      = 6060
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "mcp-server"
      image  = "${var.acr_login_server}/${var.project}-agent-mcp-server:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "COSMOS_ENDPOINT"
        value = var.cosmos_endpoint
      }

      env {
        name        = "COSMOS_KEY"
        secret_name = "cosmos-key"
      }

      env {
        name  = "COSMOS_DATABASE"
        value = var.cosmos_database
      }

      env {
        name  = "MCP_SERVER_PORT"
        value = "6060"
      }
    }
  }

  tags = {
    project     = var.project
    environment = var.environment
    agent       = "mcp-server"
  }
}

resource "azurerm_container_app" "backend" {
  name                         = "ca-${var.project}-backend-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.agents.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.agents.id
  }

  secret {
    name  = "cosmos-key"
    value = var.cosmos_key
  }

  secret {
    name  = "openai-key"
    value = var.openai_key
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "backend"
      image  = "${var.acr_login_server}/${var.project}-backend:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "HTTP_PORT"
        value = "8080"
      }

      env {
        name  = "GRPC_PORT"
        value = "50051"
      }

      env {
        name  = "COSMOS_ENDPOINT"
        value = var.cosmos_endpoint
      }

      env {
        name        = "COSMOS_KEY"
        secret_name = "cosmos-key"
      }

      env {
        name  = "COSMOS_DATABASE"
        value = var.cosmos_database
      }

      env {
        name  = "AZURE_OPENAI_ENDPOINT"
        value = var.openai_endpoint
      }

      env {
        name        = "AZURE_OPENAI_KEY"
        secret_name = "openai-key"
      }

      env {
        name  = "AZURE_OPENAI_DEPLOYMENT"
        value = var.openai_deployment
      }

      env {
        name  = "RISK_AGENT_URL"
        value = local.agent_fqdns["risk-assessment"]
      }

      env {
        name  = "RECOMMENDATION_AGENT_URL"
        value = local.agent_fqdns["recommendation"]
      }

      env {
        name  = "TRIAGE_AGENT_URL"
        value = local.agent_fqdns["exception-triage"]
      }

      env {
        name  = "RATIONALE_AGENT_URL"
        value = local.agent_fqdns["rationale"]
      }

      env {
        name  = "INSIGHTS_AGENT_URL"
        value = local.agent_fqdns["insights"]
      }

      env {
        name  = "NOTIFICATION_AGENT_URL"
        value = local.agent_fqdns["notification"]
      }

      liveness_probe {
        transport            = "HTTP"
        port                 = 8080
        path                 = "/health"
        initial_delay        = 10
        interval_seconds     = 15
        failure_count_threshold = 3
      }

      readiness_probe {
        transport        = "HTTP"
        port             = 8080
        path             = "/health"
        interval_seconds = 10
      }
    }
  }

  tags = {
    project     = var.project
    environment = var.environment
  }
}

resource "azurerm_container_app" "frontend" {
  name                         = "ca-${var.project}-frontend-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.agents.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.agents.id
  }

  ingress {
    external_enabled = true
    target_port      = 80
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "frontend"
      image  = "${var.acr_login_server}/${var.project}-frontend:latest"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "BACKEND_URL"
        value = local.backend_url
      }
    }
  }

  tags = {
    project     = var.project
    environment = var.environment
  }
}
