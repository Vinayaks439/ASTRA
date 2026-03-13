#!/bin/bash
# One-time AKS setup after Terraform apply:
# - Get AKS credentials
# - Install NGINX Ingress Controller via Helm
# - Apply all K8s manifests
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR/infra"

RG=$(terraform output -raw aks_resource_group)
CLUSTER=$(terraform output -raw aks_cluster_name)
ACR=$(terraform output -raw acr_login_server)

echo "==> Getting AKS credentials..."
az aks get-credentials --resource-group "$RG" --name "$CLUSTER" --overwrite-existing

echo "==> Installing NGINX Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.replicaCount=2

echo "==> Applying K8s manifests..."
kubectl apply -f "$ROOT_DIR/k8s/namespace.yaml"
kubectl apply -f "$ROOT_DIR/k8s/backend/"
kubectl apply -f "$ROOT_DIR/k8s/frontend/"

echo ""
echo "==> AKS setup complete."
echo ""
echo "Next steps:"
echo "1. Update k8s/backend/configmap.yaml with Container Apps FQDNs from: terraform output container_app_fqdns"
echo "2. Update k8s/backend/secret-provider-class.yaml with your tenant ID and kubelet identity"
echo "3. Update k8s/backend/deployment.yaml and k8s/frontend/deployment.yaml image references with: $ACR"
echo "4. Re-apply: kubectl apply -f k8s/backend/ && kubectl apply -f k8s/frontend/"
echo ""
echo "Ingress external IP (may take a minute to provision):"
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "(pending)"
echo ""
