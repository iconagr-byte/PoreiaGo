# Shared by both PoreiaGo + Achillio server blocks (included from frontend.conf).
# Docker embedded DNS — re-resolve api-blue after container recreate.
resolver 127.0.0.11 valid=10s ipv6=off;

# sub_filter needs the response buffered through nginx (not kernel sendfile).
sendfile off;
gzip on;
gzip_types text/css application/javascript application/json;

location /api/ {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream;
    proxy_http_version 1.1;
    client_max_body_size 12m;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_read_timeout 120s;
    proxy_connect_timeout 10s;
    proxy_send_timeout 120s;
}

location /ws/ {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location = /health {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_connect_timeout 5s;
    proxy_read_timeout 10s;
}

location ^~ /admin/scan {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /admin/boarding {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /admin/offline-manifest {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /admin/sms {
    set $api_upstream api-blue:8000;
    proxy_pass http://$api_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location ^~ /wallet-pwa/ {
    try_files $uri =404;
    add_header Cache-Control "no-cache";
}
location = /wallet-pwa/sw.js {
    try_files $uri =404;
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/wallet";
}

location ^~ /rental-pwa/ {
    try_files $uri =404;
    add_header Cache-Control "no-cache";
}
location = /rental-pwa/sw.js {
    try_files $uri =404;
    add_header Cache-Control "no-cache";
    add_header Service-Worker-Allowed "/rent";
}

location = /sw.js {
    try_files $uri =404;
    add_header Cache-Control "no-cache";
}
location = /driver-sw.js {
    try_files $uri =404;
    add_header Cache-Control "no-cache";
}

location = /index.html {
    add_header Cache-Control "no-cache";
}
location = /index.achillio.html {
    add_header Cache-Control "no-cache";
}

location /assets/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
