#!/bin/bash

# Test script to verify Gemini File Search API works correctly
# This will help us find the exact correct format

cd /Users/krishna.poddar/leaderboard

echo "=========================================="
echo "GEMINI FILE SEARCH API TEST"
echo "=========================================="
echo ""

# Get API key from Supabase secrets
GEMINI_API_KEY=$(supabase secrets list | grep GEMINI_API_KEY | awk '{print $1}')

if [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ GEMINI_API_KEY not found in secrets"
    echo "Run: supabase secrets set GEMINI_API_KEY=your-key-here"
    exit 1
fi

echo "✅ API Key found in secrets"
echo ""

# Decrypt the actual key (it's hashed in the list output)
# We need the actual key value - let's get it differently
echo "⚠️  Note: The key shown above is hashed. You need the actual key."
echo ""
echo "To get your actual GEMINI_API_KEY, check your .env file or:"
echo "https://aistudio.google.com/apikey"
echo ""
echo "For this test, please run manually:"
echo ""
echo "export GEMINI_API_KEY='your-actual-key-here'"
echo ""
echo "Then run these curl commands:"
echo ""

cat << 'EOF'
# Step 1: Create a File Search Store
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Test Store"
  }' | jq

# Save the store name from response: "name": "fileSearchStores/xxx"
export STORE_NAME="fileSearchStores/xxx"  # Replace with actual value

# Step 2: Create a test file
echo "This is a test research report about technology sector growth drivers." > /tmp/test-report.txt

# Step 3: Upload file to File Search Store
# Note: This requires multipart upload with resumable protocol
# First, get the upload URL:
curl -X POST \
  "https://generativelanguage.googleapis.com/upload/v1beta/$STORE_NAME:uploadToFileSearchStore?key=$GEMINI_API_KEY" \
  -H "X-Goog-Upload-Protocol: resumable" \
  -H "X-Goog-Upload-Command: start" \
  -H "X-Goog-Upload-Header-Content-Type: text/plain" \
  -H "X-Goog-Upload-Header-Content-Length: $(wc -c < /tmp/test-report.txt)" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "test-report.txt",
    "mimeType": "text/plain"
  }' -D - | grep -i "x-goog-upload-url"

# Save the upload URL from header
export UPLOAD_URL="..."  # Get from X-Goog-Upload-URL header

# Upload the actual file data
curl -X POST "$UPLOAD_URL" \
  -H "Content-Length: $(wc -c < /tmp/test-report.txt)" \
  -H "X-Goog-Upload-Offset: 0" \
  -H "X-Goog-Upload-Command: upload, finalize" \
  --data-binary "@/tmp/test-report.txt" | jq

# Save the operation name from response: "name": "operations/xxx"
export OPERATION_NAME="fileSearchStores/xxx/operations/yyy"  # Full path

# Step 4: Poll for operation completion
curl -X GET \
  "https://generativelanguage.googleapis.com/v1beta/$OPERATION_NAME?key=$GEMINI_API_KEY" | jq

# Step 5: Test generateContent with File Search (once operation is done)
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "What are the growth drivers mentioned in the reports?"
          }
        ]
      }
    ],
    "tools": [
      {
        "fileSearch": {
          "fileSearchStoreNames": ["'"$STORE_NAME"'"]
        }
      }
    ]
  }' | jq

# If the above fails with tool_type error, try with snake_case:
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [
      {
        "role": "user",
        "parts": [
          {
            "text": "What are the growth drivers mentioned in the reports?"
          }
        ]
      }
    ],
    "tools": [
      {
        "file_search": {
          "file_search_store_names": ["'"$STORE_NAME"'"]
        }
      }
    ]
  }' | jq

EOF

echo ""
echo "=========================================="
echo "Copy the commands above and run them manually after setting GEMINI_API_KEY"
echo "=========================================="

