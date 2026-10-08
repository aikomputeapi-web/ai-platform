# DNS + TLS finish plan for aikompute.com on 3.14.136.76
# Run each step in order once DNS points at 3.14.136.76.
# Everything here is pre-staged; no decisions needed.

# 0. Confirm DNS propagated (from Windows):
#    nslookup aikompute.com  -> expect 3.14.136.76 (or Cloudflare IPs if proxied)

# 1. Publish nginx with TLS sections removed temporarily (HTTP-01 needs port 80 only):
ssh aikofreetier "sudo apt-get install -y jq 2>/dev/null; true"

# On the server, generate the HTTP-only variant (443 blocks dropped):
#   sudo awk '/listen 443/{skip=1} skip&&/^    }$/{skip=0;next} !skip' /opt/ai-platform/nginx/nginx.conf \
#     | sed 's/DOMAIN_PLACEHOLDER/aikompute.com/g; s/SSL_CERT_NAME_PLACEHOLDER/aikompute.com/g' \
#     > /tmp/nginx.http.conf && sudo nginx -t -c /tmp/nginx.http.conf
#   sudo cp /tmp/nginx.http.conf /etc/nginx/nginx.conf && sudo systemctl reload nginx

# 2. Issue the cert (grey-cloud required; orange-cloud proxied A records make
#    HTTP-01 fail because LE gets a Cloudflare edge IP):
#   sudo certbot certonly --webroot -w /var/www/certbot -d aikompute.com -d admin.aikompute.com --non-interactive --agree-tos -m michaelcord17@gmail.com

# 3. Install the full config (TLS sections present, cert path aikompute.com):
#   sudo sed 's/DOMAIN_PLACEHOLDER/aikompute.com/g; s/SSL_CERT_NAME_PLACEHOLDER/aikompute.com/g' \
#     /opt/ai-platform/nginx/nginx.conf > /tmp/nginx.tls.conf
#   sudo sed 's|listen 443 ssl http2;|listen 443 ssl;\n        http2 on;|g; s|listen \[::\]:443 ssl http2;|listen [::]:443 ssl;\n        http2 on;|g' \
#     /tmp/nginx.tls.conf > /etc/nginx/nginx.conf   # fixes deprecated http2-in-listen warnings
#   sudo nginx -t && sudo systemctl reload nginx

# 4. Verify (from Windows):
#    curl.exe -k https://aikompute.com/health        (nginx->omniroute 307/200)
#    curl.exe -s https://aikompute.com/v1/models     (API route)
#    admin.aikompute.com -> dashboard (upstream omniroute_dashboard on 52965 does NOT exist
#    in this compose stack - admin block proxies to localhost:52965 + omniroute_dashboard
#    upstream that the repo nginx.conf references; the unified compose publishes the
#    dashboard on 20128. If admin.aikompute.com shows 502, repoint the admin location / to
#    http://127.0.0.1:20128 and the coms-net upstream stays as-is.)

# 5. User may re-enable Cloudflare orange-cloud after TLS is live.
