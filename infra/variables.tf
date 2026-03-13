variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "astra"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "eastus"
}

variable "aks_node_count" {
  description = "Number of nodes in the AKS default node pool"
  type        = number
  default     = 2
}

variable "aks_node_vm_size" {
  description = "VM size for AKS nodes"
  type        = string
  default     = "Standard_D2s_v3"
}

variable "cosmos_db_name" {
  description = "Cosmos DB database name"
  type        = string
  default     = "voltedge-pricing-db"
}

variable "openai_model" {
  description = "Azure OpenAI model name"
  type        = string
  default     = "gpt-4o-mini"
}

variable "openai_deployment" {
  description = "Azure OpenAI deployment name"
  type        = string
  default     = "astra-gpt"
}

variable "openai_capacity" {
  description = "Azure OpenAI capacity in thousands of tokens per minute"
  type        = number
  default     = 30
}
