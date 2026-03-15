variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "acr_login_server" {
  type = string
}

variable "acr_id" {
  type = string
}

variable "key_vault_id" {
  type = string
}

variable "cosmos_endpoint" {
  type = string
}

variable "cosmos_key" {
  type      = string
  sensitive = true
}

variable "cosmos_database" {
  type    = string
  default = "voltedge-pricing-db"
}

variable "openai_endpoint" {
  type = string
}

variable "openai_key" {
  type      = string
  sensitive = true
}

variable "openai_deployment" {
  type    = string
  default = "astra-gpt"
}

variable "serp_api_key" {
  type      = string
  sensitive = true
  default   = ""
}
