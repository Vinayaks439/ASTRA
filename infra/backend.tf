terraform {
  backend "azurerm" {
    resource_group_name  = "astra-tfstate"
    storage_account_name = "astratfstate"
    container_name       = "tfstate"
    key                  = "astra.terraform.tfstate"
  }
}
