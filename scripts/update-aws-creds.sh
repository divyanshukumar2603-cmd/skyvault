#!/usr/bin/env bash
# Update the AWS credentials in .env from an AWS Academy Learner Lab block.
#
#   ./scripts/update-aws-creds.sh ~/Downloads/creds.txt
#   pbpaste | ./scripts/update-aws-creds.sh          # straight from the clipboard
#
# Accepts exactly what "AWS Details -> AWS CLI" gives you:
#
#   [default]
#   aws_access_key_id=ASIA...
#   aws_secret_access_key=...
#   aws_session_token=IQoJ...
#
# Learner Lab credentials expire when the lab session ends, so this is a
# routine chore rather than a one-off.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
INPUT=$(cat "${1:-/dev/stdin}")

get() { printf '%s\n' "$INPUT" | grep -m1 "^[[:space:]]*$1[[:space:]]*=" | sed -E "s/^[^=]*=[[:space:]]*//" | tr -d '\r"'; }

KEY=$(get aws_access_key_id)
SECRET=$(get aws_secret_access_key)
TOKEN=$(get aws_session_token)

if [[ -z "$KEY" || -z "$SECRET" || -z "$TOKEN" ]]; then
  echo "ERROR: could not find all three values in the input." >&2
  echo "Expected lines: aws_access_key_id, aws_secret_access_key, aws_session_token" >&2
  exit 1
fi

cp "$ENV_FILE" "${ENV_FILE}.bak"

# Values contain / and + so use a delimiter that cannot appear in them.
python3 - "$ENV_FILE" "$KEY" "$SECRET" "$TOKEN" <<'PY'
import sys, re, pathlib
env_path, key, secret, token = sys.argv[1:5]
p = pathlib.Path(env_path)
s = p.read_text()
for name, value in (('S3_ACCESS_KEY_ID', key), ('S3_SECRET_ACCESS_KEY', secret), ('AWS_SESSION_TOKEN', token)):
    pattern = re.compile(rf'^{name}=.*$', re.MULTILINE)
    if pattern.search(s):
        s = pattern.sub(f'{name}={value}', s)
    else:
        s += f'\n{name}={value}\n'
p.write_text(s)
PY

echo "Updated .env (previous version saved as .env.bak)"
echo "  S3_ACCESS_KEY_ID=${KEY:0:10}…"
echo "  AWS_SESSION_TOKEN=${TOKEN:0:12}… (${#TOKEN} chars)"
echo ""
echo "Verifying against AWS…"
cd "$PROJECT_ROOT"
NODE_PATH=backend/node_modules node -e "
require('dotenv').config({path:'.env'});
const S=require('@aws-sdk/client-s3'); const e=process.env;
const c=new S.S3Client({region:e.AWS_REGION,credentials:{accessKeyId:e.S3_ACCESS_KEY_ID,secretAccessKey:e.S3_SECRET_ACCESS_KEY,sessionToken:e.AWS_SESSION_TOKEN}});
c.send(new S.ListObjectsV2Command({Bucket:e.S3_PRIMARY_BUCKET,MaxKeys:1}))
 .then(()=>console.log('  credentials VALID — S3 reachable'))
 .catch(err=>{console.log('  credentials REJECTED:',err.name); process.exit(1);});
"
