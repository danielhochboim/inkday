#!/usr/bin/env bash
set -euo pipefail
read -rsp 'הדבק את כתובת ההפניה המלאה ולחץ Enter: ' auth_url
echo
gog_pass="$(sudo awk -F= '/^GOG_KEYRING_PASSWORD=/{print $2}' /etc/inkday/inkday.env)"
HOME=/home/ubuntu GOG_KEYRING_PASSWORD="$gog_pass" /usr/local/bin/gog auth add \
  daniel.hochboim@gmail.com --services calendar --readonly --remote --step 2 \
  --auth-url "$auth_url"
unset auth_url gog_pass
