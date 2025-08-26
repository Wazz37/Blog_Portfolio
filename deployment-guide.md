# Portfolio Website Deployment Guide

This guide will help you deploy your portfolio website on any server or hosting platform.

## 🚀 Quick Start

1. **Upload Files**: Upload all files to your web server's root directory
2. **Configure Domain**: Point your domain to your server
3. **Test**: Visit your website to ensure everything works

## 📁 File Structure

```
your-portfolio/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # JavaScript functionality
├── deployment-guide.md # This file
├── .htaccess          # Apache configuration (optional)
└── robots.txt         # SEO configuration
```

## 🌐 Hosting Options

### Option 1: Shared Hosting (cPanel, etc.)
- Upload files via File Manager or FTP
- Place files in `public_html` or `www` folder
- No additional configuration needed

### Option 2: VPS/Dedicated Server
- Upload files to `/var/www/html/` or your web directory
- Configure web server (Apache/Nginx)
- Set up SSL certificate

### Option 3: Cloud Platforms
- **Netlify**: Drag & drop deployment
- **Vercel**: Git-based deployment
- **GitHub Pages**: Free hosting for public repos
- **AWS S3**: Static website hosting

### Option 4: CDN Services
- **Cloudflare**: Free CDN with hosting
- **Bunny.net**: High-performance CDN

## 🔧 Server Configuration

### Apache (.htaccess)
```apache
# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Browser caching
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
</IfModule>
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static files
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔒 SSL/HTTPS Setup

### Let's Encrypt (Free)
```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-apache

# Get certificate
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Cloudflare (Free)
1. Add your domain to Cloudflare
2. Update nameservers
3. Enable "Always Use HTTPS"
4. Enable "SSL/TLS encryption mode: Full"

## 📱 Mobile Optimization

The website is already mobile-responsive, but you can enhance it:

### Viewport Meta Tag (Already included)
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### PWA Support (Optional)
Create a `manifest.json` file for app-like experience:
```json
{
  "name": "Research Engineer Portfolio",
  "short_name": "Portfolio",
  "description": "Deep Learning & Computer Vision Research Engineer",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 🔍 SEO Optimization

### Meta Tags (Already included)
- Title, description, keywords
- Open Graph tags for social sharing
- Twitter Card support

### robots.txt
```txt
User-agent: *
Allow: /
Sitemap: https://yourdomain.com/sitemap.xml
```

### sitemap.xml (Optional)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

## 📊 Performance Optimization

### Image Optimization
- Use WebP format when possible
- Compress images (tools: TinyPNG, ImageOptim)
- Implement lazy loading (already included)

### Minification (Optional)
```bash
# Install minification tools
npm install -g html-minifier cssnano uglify-js

# Minify files
html-minifier --collapse-whitespace --remove-comments index.html -o index.min.html
cssnano styles.css styles.min.css
uglifyjs script.js -o script.min.js
```

## 🚨 Common Issues & Solutions

### 1. 404 Errors
- Ensure `index.html` is in the root directory
- Check server configuration
- Verify file permissions (644 for files, 755 for directories)

### 2. CSS/JS Not Loading
- Check file paths
- Verify file permissions
- Clear browser cache

### 3. Mobile Menu Not Working
- Check JavaScript console for errors
- Ensure all files are uploaded
- Test on different devices

### 4. Slow Loading
- Enable Gzip compression
- Optimize images
- Use CDN for external resources

## 🔧 Customization

### Update Personal Information
1. Edit `index.html` to change:
   - Your name and title
   - About me content
   - Contact information
   - Blog post content

2. Modify `styles.css` to change:
   - Colors (currently black & white theme)
   - Fonts
   - Layout spacing

3. Update `script.js` for:
   - Form handling
   - Additional animations
   - Custom functionality

### Add Real Images
Replace Font Awesome icons with real images:
```html
<!-- Instead of: -->
<i class="fas fa-brain"></i>

<!-- Use: -->
<img src="your-image.jpg" alt="Description" class="hero-image">
```

## 📈 Analytics & Monitoring

### Google Analytics
```html
<!-- Add to <head> section -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Performance Monitoring
- **Google PageSpeed Insights**: Test website performance
- **GTmetrix**: Detailed performance analysis
- **WebPageTest**: Advanced testing

## 🆘 Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Verify all files are uploaded correctly
3. Test on different browsers/devices
4. Check server error logs

## 🎯 Next Steps

After deployment:
1. **Test thoroughly** on different devices
2. **Set up monitoring** and analytics
3. **Create content** for your blog posts
4. **Optimize for search engines**
5. **Regular updates** and maintenance

---

**Happy Deploying! 🚀**

Your portfolio website is now ready to showcase your expertise in Deep Learning, Computer Vision, and ADAS engineering to the world.
