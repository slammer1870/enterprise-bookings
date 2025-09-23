# Image Optimization Guide - Brú Grappling

## Overview
This document outlines the image optimization strategies implemented to improve loading times on Hetzner deployment via Coolify.

## Current Issues Identified
1. **Large unoptimized images**: 2.8MB and 3.3MB photos in media folder
2. **Mixed optimization**: Some components used Next.js Image (optimized), others used regular img tags
3. **No CDN strategy**: Images served directly from server
4. **No responsive image sizes**: Single large images for all screen sizes

## Solutions Implemented

### 1. Payload CMS Media Collection Optimization

**File**: `src/collections/Media.ts`

- **Automatic WebP conversion** with 80% quality
- **Multiple responsive sizes**:
  - `thumbnail`: 400x300px (80% quality)
  - `card`: 768x1024px (85% quality)
  - `tablet`: 1024px wide (85% quality)
  - `desktop`: 1920px wide (80% quality)
- **File size limit**: Reduced to 10MB
- **Higher compression effort**: Level 6 for better optimization

### 2. Next.js Image Configuration

**File**: `next.config.mjs`

- **AVIF format priority**: Better compression than WebP
- **Quality optimization**: Set to 80% for better size/quality balance
- **Long-term caching**: 1 year cache TTL
- **Proper cache headers**: Immutable caching for optimized images

### 3. Smart Image Component

**File**: `src/components/OptimizedImage.tsx`

- **Automatic size selection**: Chooses best image size based on requested dimensions
- **Responsive sizes**: Generates appropriate sizes attribute
- **Fallback handling**: Graceful degradation if optimized sizes unavailable
- **Type-safe**: Full TypeScript integration with Payload types

### 4. Component Updates

Updated components to use `OptimizedImage`:
- `src/blocks/hero/index.tsx`
- `src/blocks/hero-waitlist/index.tsx`
- `src/globals/footer/client.tsx`

### 5. Docker Optimization

**File**: `Dockerfile`

- **Media folder copying**: Ensures local images are available in container
- **Static asset optimization**: Proper file permissions and ownership

## Performance Improvements Expected

### Before Optimization
- **Large images**: 2.8MB-3.3MB photos
- **No responsive sizes**: Single large image for all devices
- **No modern formats**: JPEG/PNG only
- **Mixed optimization**: Some components unoptimized

### After Optimization
- **Automatic compression**: 60-80% file size reduction expected
- **Modern formats**: AVIF/WebP support
- **Responsive delivery**: Right size for each device
- **Consistent optimization**: All images use optimized pipeline

## Usage Examples

### Basic Usage
```tsx
import { OptimizedImage } from '@/components/OptimizedImage'

<OptimizedImage 
  media={mediaObject}
  width={800}
  height={600}
  alt="Description"
/>
```

### Responsive Fill
```tsx
<OptimizedImage 
  media={mediaObject}
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
  className="object-cover"
/>
```

### Priority Loading
```tsx
<OptimizedImage 
  media={mediaObject}
  width={1200}
  height={800}
  priority
  sizes="100vw"
/>
```

## CDN Recommendations

For further optimization on Hetzner/Coolify:

### Option 1: Cloudflare (Recommended)
- **Free tier available**
- **Automatic image optimization**
- **Global CDN**
- **Easy integration with existing domain**

Setup:
1. Add domain to Cloudflare
2. Enable "Polish" (image optimization)
3. Configure cache rules for `/media/*` and `/_next/image/*`

### Option 2: Bunny CDN
- **Cost-effective**
- **Image optimization API**
- **European data centers** (good for Hetzner)

### Option 3: ImageKit
- **Specialized image CDN**
- **Real-time transformations**
- **Free tier: 20GB bandwidth**

## Monitoring & Testing

### Tools to Monitor Performance
1. **Lighthouse**: Core Web Vitals
2. **GTmetrix**: Image optimization scores
3. **WebPageTest**: Loading waterfall
4. **Chrome DevTools**: Network tab analysis

### Key Metrics to Track
- **Largest Contentful Paint (LCP)**: Should improve significantly
- **Cumulative Layout Shift (CLS)**: Ensure images have dimensions
- **First Contentful Paint (FCP)**: Faster with optimized images
- **Total page size**: Should reduce by 50-70%

## Running the Optimization Script

To optimize existing images in the media folder:

```bash
npm run optimize:images
```

This will:
- Create backups in `media-backup/`
- Compress existing images
- Maintain aspect ratios
- Show compression statistics

## Maintenance

### Regular Tasks
1. **Monitor image uploads**: Ensure CMS users upload reasonable file sizes
2. **Check optimization**: Verify new images are being processed correctly
3. **Update sizes**: Add new responsive sizes if needed for new components
4. **CDN monitoring**: Track CDN performance and costs

### Troubleshooting

**Images not loading?**
- Check media folder permissions
- Verify Docker media copy step
- Check Next.js image domains configuration

**Poor optimization?**
- Verify Sharp is working correctly
- Check Payload media configuration
- Review image format support

**Slow loading still?**
- Consider implementing CDN
- Check server response times
- Analyze network requests in DevTools

## Next Steps

1. **Implement CDN**: Choose and configure a CDN solution
2. **Monitor performance**: Set up performance monitoring
3. **Optimize existing content**: Run optimization script on current media
4. **User training**: Educate content creators on optimal image sizes
