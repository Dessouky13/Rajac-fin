#!/bin/bash

# A script to deploy the backend to Google Cloud Run.
#
# Instructions:
# 1. Make sure you have authenticated with gcloud: `gcloud auth login`
# 2. Set your project: `gcloud config set project YOUR_PROJECT_ID`
# 3. Make this script executable: `chmod +x deploy-gcp.sh`
# 4. Run the script with your project ID, region, and sheet ID:
#    ./deploy-gcp.sh YOUR_PROJECT_ID gcp-region-here your-google-sheet-id-here
#    ./deploy-gcp.sh your-gcp-region

set -e # Exit immediately if a command exits with a non-zero status.

# --- Your Project Configuration ---
PROJECT_ID="dogwood-harmony-459220-n7"
SHEET_ID="1kclx7cMk9FKNP_QzZK4wrOdrDLOHQGqqhp1t72wTKQ4"
DRIVE_FOLDER_ID="1O8yZWNnxJPPIA-T7PuqAfIbCCnNnESd6"
REGION=$1 # The region is now the first and only argument

SERVICE_NAME="rajac-finance-backend"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"
SECRET_NAME="google_sa_key"

if [ -z "$REGION" ]; then
  echo "Usage: ./deploy-gcp.sh <REGION>"
  echo "Example: ./deploy-gcp.sh us-central1"
  exit 1
fi

echo "Step 1: Building and pushing container image..."
gcloud builds submit --tag "$IMAGE_TAG" .

echo "Step 2: Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --region "$REGION" \
  --platform "managed" \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_MASTER_SHEET_ID=${SHEET_ID},GOOGLE_DRIVE_FOLDER_ID=${DRIVE_FOLDER_ID}" \
  --set-secrets "/etc/secrets/google-sa-key.json=${SECRET_NAME}:latest"

echo "Deployment successful!"
echo "Service URL: $(gcloud run services describe ${SERVICE_NAME} --platform managed --region ${REGION} --format 'value(status.url)')"

echo "Note: Your application code needs to read the service account from the file path /etc/secrets/google-sa-key.json"