#!/bin/bash
# Full scrape-and-deploy cycle.
set -e
cd "$(dirname "$0")"
exec ./update-seminars.sh "$@"
