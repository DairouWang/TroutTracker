#!/bin/bash

# TroutTracker Deployment Script

set -e

PROJECT_NAME="TroutTracker"
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-west-2"
fi
STACK_NAME="${PROJECT_NAME}-Stack"
ENABLE_CLOUDFRONT="${ENABLE_CLOUDFRONT:-true}"

echo "Using AWS Region: $REGION"
echo "CloudFront: $ENABLE_CLOUDFRONT"

echo "=========================================="
echo "TroutTracker Deployment Script"
echo "=========================================="

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not found, please install it first"
    exit 1
fi

# Check Google Geocoding API Key
if [ -z "$GOOGLE_GEOCODING_API_KEY" ]; then
    # Try to get from command line argument
    if [ -n "$1" ]; then
        GOOGLE_GEOCODING_API_KEY="$1"
        echo "Using command line argument as API key"
    else
        echo "Error: Please set environment variable GOOGLE_GEOCODING_API_KEY"
        echo "Or run: ./deploy.sh your-api-key"
        exit 1
    fi
fi

# If GOOGLE_MAPS_API_KEY is not set, use the same key
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    GOOGLE_MAPS_API_KEY="$GOOGLE_GEOCODING_API_KEY"
fi

echo "Step 1: Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file cloudformation.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        GoogleGeocodingApiKey=$GOOGLE_GEOCODING_API_KEY \
        ProjectName=$PROJECT_NAME \
        EnableCloudFront=$ENABLE_CLOUDFRONT \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo "Step 2: Packaging and deploying Scraper Lambda..."
cd ../backend/scraper
pip install -r requirements.txt -t .
echo "Creating zip package (excluding test files)..."
zip -r scraper.zip . -x "*.pyc" -x "__pycache__/*" -x "*/tests/*" -x "*/test/*" -x "*.pyx" -x "*.pxi" -q

SCRAPER_FUNCTION_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ScraperFunctionName`].OutputValue' \
    --output text \
    --region $REGION)

echo "Uploading Scraper Lambda (this may take a minute)..."
aws lambda update-function-code \
    --function-name $SCRAPER_FUNCTION_NAME \
    --zip-file fileb://scraper.zip \
    --region $REGION \
    --output text > /dev/null 2>&1 && echo "✓ Upload complete"

rm scraper.zip
echo "Scraper Lambda deployed successfully!"

echo "Step 3: Packaging and deploying API Lambda..."
cd ../api
pip install -r requirements.txt -t .
echo "Creating zip package..."
zip -r api.zip . -x "*.pyc" -x "__pycache__/*" -x "*/tests/*" -x "*/test/*" -q

API_FUNCTION_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiFunctionName`].OutputValue' \
    --output text \
    --region $REGION)

echo "Uploading API Lambda..."
aws lambda update-function-code \
    --function-name $API_FUNCTION_NAME \
    --zip-file fileb://api.zip \
    --region $REGION \
    --output text > /dev/null 2>&1 && echo "✓ Upload complete"

rm api.zip
echo "API Lambda deployed successfully!"

echo "Step 4: Building and deploying frontend..."
cd ../../frontend

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text \
    --region $REGION)

# Create .env.production file
cat > .env.production <<EOF
VITE_API_ENDPOINT=${API_ENDPOINT}
VITE_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
EOF

npm install
npm run build

# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text \
    --region $REGION)

echo "Uploading to S3 bucket: ${BUCKET_NAME}"

# Upload to S3 with optimized cache headers
echo "Uploading assets with cache headers..."
aws s3 sync dist/ s3://${BUCKET_NAME} \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --region $REGION

# Upload index.html with no-cache
echo "Uploading index.html..."
aws s3 cp dist/index.html s3://${BUCKET_NAME}/index.html \
    --cache-control "public, max-age=0, must-revalidate" \
    --region $REGION

echo "✓ Frontend uploaded to S3"

# Invalidate CloudFront cache if enabled
if [ "$ENABLE_CLOUDFRONT" = "true" ]; then
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
        --output text \
        --region $REGION)
    
    if [ ! -z "$CLOUDFRONT_ID" ] && [ "$CLOUDFRONT_ID" != "None" ]; then
        echo "Invalidating CloudFront cache..."
        aws cloudfront create-invalidation \
            --distribution-id $CLOUDFRONT_ID \
            --paths "/*" \
            --region $REGION > /dev/null
        echo "✓ CloudFront cache invalidated"
    fi
fi

# Get final URLs
FRONTEND_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendUrl`].OutputValue' \
    --output text \
    --region $REGION)

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo "API Endpoint: ${API_ENDPOINT}"
echo "Frontend URL: ${FRONTEND_URL}"
if [ "$ENABLE_CLOUDFRONT" = "true" ]; then
    echo "CloudFront Distribution: ${CLOUDFRONT_ID}"
fi
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Visit your frontend URL to test the application"
echo "2. Trigger the scraper manually to populate data:"
echo "   aws lambda invoke --function-name ${SCRAPER_FUNCTION_NAME} response.json"
echo "=========================================="

