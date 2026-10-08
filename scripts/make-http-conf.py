#!/usr/bin/env python3
"""Generate the HTTP-only nginx variant from the repo config (443 blocks dropped).
Run on the server:  sudo python3 make-http-conf.py
Output: /tmp/nginx.http.conf
"""
import sys

SRC = "/opt/ai-platform/nginx/nginx.conf"
OUT = "/tmp/nginx.http.conf"

lines = open(SRC).read().split("\n")
out, i = [], 0
while i < len(lines):
    l = lines[i]
    if "listen 443" in l:
        # rewind to the "server {" opener of this block and drop the whole block
        for j in range(len(out) - 1, -1, -1):
            if out[j].strip() == "server {":
                out = out[:j]
                break
        depth = 1
        i += 1
        while i < len(lines) and depth > 0:
            depth += lines[i].count("{") - lines[i].count("}")
            i += 1
        continue
    out.append(l)
    i += 1

conf = "\n".join(out)
conf = conf.replace("DOMAIN_PLACEHOLDER", "aikompute.com")
conf = conf.replace("SSL_CERT_NAME_PLACEHOLDER", "aikompute.com")
open(OUT, "w").write(conf)
print("WROTE", OUT, len(out), "lines")
