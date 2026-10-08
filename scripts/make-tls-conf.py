#!/usr/bin/env python3
"""Generate the full TLS nginx config from the repo config.
Run on the server:  sudo python3 make-tls-conf.py
Output: /tmp/nginx.tls.conf (validated, then copied to /etc/nginx/nginx.conf)
"""
SRC = "/opt/ai-platform/nginx/nginx.conf"
OUT = "/tmp/nginx.tls.conf"

conf = open(SRC).read()
conf = conf.replace("DOMAIN_PLACEHOLDER", "aikompute.com")
conf = conf.replace("SSL_CERT_NAME_PLACEHOLDER", "aikompute.com")
# nginx 1.25+: http2 in listen is deprecated; use the standalone directive
conf = conf.replace("listen 443 ssl http2;\n        listen [::]:443 ssl http2;", "listen 443 ssl;\n        listen [::]:443 ssl;\n        http2 on;")
conf = conf.replace("listen 443 ssl http2;", "listen 443 ssl;\n        http2 on;")
conf = conf.replace("listen [::]:443 ssl http2;", "listen [::]:443 ssl;\n        http2 on;")
open(OUT, "w").write(conf)
print("TLS_CONF_WRITTEN", OUT, len(conf.split("\n")), "lines")
