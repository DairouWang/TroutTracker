#!/bin/bash

# CloudFront Cache Invalidation Script
# Usage: ./invalidate-cache.sh [paths]
# Example: ./invalidate-cache.sh "/*"
# Example: ./invalidate-cache.sh "/index.html" "/assets/*"

set -e

PROJECT_NAME="TroutTracker"
STACK_NAME="${PROJECT_NAME}-Stack"
REGION=$(aws configure get region)
if [ -z "$REGION" ]; then
    REGION="us-west-2"
fi

# Get CloudFront Distribution ID
CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text \
    --region $REGION)

if [ -z "$CLOUDFRONT_ID" ] || [ "$CLOUDFRONT_ID" = "None" ]; then
    echo "Error: CloudFront distribution not found"
    echo "Make sure CloudFront is enabled in your stack"
    exit 1
fi

# Set default paths if not provided
PATHS="${@:-/*}"

echo "=========================================="
echo "CloudFront Cache Invalidation"
echo "=========================================="
echo "Distribution ID: $CLOUDFRONT_ID"
echo "Paths to invalidate: $PATHS"
echo ""

# Create invalidation
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_ID \
    --paths $PATHS \
    --query 'Invalidation.Id' \
    --output text)

echo "✓ Invalidation created: $INVALIDATION_ID"
echo ""
echo "Checking status..."

# Wait for invalidation to complete (optional)
if [ "$WAIT" = "true" ]; then
    echo "Waiting for invalidation to complete..."
    aws cloudfront wait invalidation-completed \
        --distribution-id $CLOUDFRONT_ID \
        --id $INVALIDATION_ID
    echo "✓ Invalidation completed!"
else
    echo "Invalidation is in progress. It may take a few minutes to complete."
    echo ""
    echo "To check status:"
    echo "aws cloudfront get-invalidation --distribution-id $CLOUDFRONT_ID --id $INVALIDATION_ID"
fi

echo "=========================================="

