resource "azurerm_cognitive_account" "openai" {
  name                = "oai-${var.project}-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  kind                = "OpenAI"
  sku_name            = "S0"

  tags = {
    project     = var.project
    environment = var.environment
  }
}

resource "azurerm_cognitive_deployment" "gpt" {
  name                 = var.deployment_name
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = var.model_name
    version = "2024-07-18"
  }

  sku {
    name     = "GlobalStandard"
    capacity = var.capacity
  }
}
