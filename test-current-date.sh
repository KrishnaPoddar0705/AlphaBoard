#!/bin/bash
echo "Current system date:"
date
echo ""
echo "JavaScript Date:"
node -e "console.log('Current:', new Date().toISOString()); const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); console.log('1 year ago:', oneYearAgo.toISOString())"
echo ""
echo "Expected for Edge Function:"
echo "End: 2025-12-01"
echo "Start: 2024-12-01"
