# HTTP server block - redirects all traffic to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ssd.baconpotatocat.com;

    # Redirect all HTTP requests to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ssd.baconpotatocat.com;

    # SSL certificate configuration
    # Update these paths to point to your SSL certificates
    ssl_certificate /etc/letsencrypt/live/ssd.baconpotatocat.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ssd.baconpotatocat.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/ssd.baconpotatocat.com.access.log;
    error_log /var/log/nginx/ssd.baconpotatocat.com.error.log;

    # Maximum upload size
    client_max_body_size 10M;

    # Proxy settings for Next.js frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}