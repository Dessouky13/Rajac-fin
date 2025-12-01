Deploying Backend to Google Cloud Run (low-cost serverless)

Why Cloud Run?
- Pay-per-use: you only pay when your container is running (free tier available).
- Easy to deploy Docker container and integrate with Google IAM and Secret Manager.
- Works well with Google Sheets/Drive APIs because you can use service account credentials stored in Secret Manager.

Steps (summary):
1. Install gcloud CLI and authenticate
2. Build container image and push to Google Container Registry (or Artifact Registry)
3. Create Cloud Run service with environment variables and secrets (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_MASTER_SHEET_ID)
4. Make sure service account has access to the spreadsheet (share the sheet with the service account email)

Detailed commands:

# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# Build and push image (Cloud Build is easier; this uses gcloud build)
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/rajac-finance-backend:latest .

# Deploy to Cloud Run
gcloud run deploy rajac-finance-backend \
  --image gcr.io/YOUR_GCP_PROJECT_ID/rajac-finance-backend:latest \
  --region YOUR_REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_MASTER_SHEET_ID=your_sheet_id"

# Use Secret Manager for credentials
# 1) Create secret with your service account JSON (do NOT paste private key directly into env var)
#    echo '{...service account json...}' | gcloud secrets create google_sa_key --data-file=-
# 2) Grant Cloud Run runtime access to the secret
#    gcloud secrets add-iam-policy-binding google_sa_key --member=serviceAccount:$(gcloud run services describe rajac-finance-backend --region=YOUR_REGION --format='value(spec.template.spec.serviceAccountName)') --role=roles/secretmanager.secretAccessor
# 3) Set the secret as an env var when deploying (Secret Manager integration)
#    gcloud run services update rajac-finance-backend --add-secrets GOOGLE_SA_JSON=google_sa_key:latest

# Inside your app, you can load the JSON from process.env.GOOGLE_SA_JSON or read from Secret Manager using the client library.

Notes:
- The current backend expects GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY as environment variables. If you store the whole JSON in Secret Manager, update `googleSheets.js` to parse that JSON and set the auth accordingly (I can add this change for you).
- Remember to share the Google Sheet with the service account email (Editor permission).

If you want, I can:
- Add support to read the full service-account JSON from a single env var (e.g., `GOOGLE_SA_JSON`) and initialize GoogleAuth from that to simplify Cloud Run secret wiring.
- Create a small CI GitHub Action to build and push automatically when you push to main.

*** End of guide ***