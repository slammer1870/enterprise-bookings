#!/usr/bin/env node

/**
 * SEO Testing Script for Brú Grappling
 * Run this script to test all SEO implementations
 */

import https from 'https';
import http from 'http';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// Test URLs to check
const testUrls = [
  '/',
  '/sitemap.xml',
  '/pages-sitemap.xml',
  '/posts-sitemap.xml',
  '/robots.txt',
  '/manifest.json',
  '/blog',
];

// Test function
function testUrl(url) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${SITE_URL}${url}`;
    const client = fullUrl.startsWith('https') ? https : http;
    
    const req = client.get(fullUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          url: fullUrl,
          status: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 500), // First 500 chars
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('error', (err) => {
      reject({
        url: fullUrl,
        error: err.message,
        success: false
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        url: fullUrl,
        error: 'Timeout',
        success: false
      });
    });
  });
}

// Main test function
async function runTests() {
  console.log('🔍 Testing SEO Implementation for Brú Grappling\n');
  console.log(`🌐 Testing site: ${SITE_URL}\n`);
  
  const results = [];
  
  for (const url of testUrls) {
    try {
      console.log(`Testing ${url}...`);
      const result = await testUrl(url);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${url} - Status: ${result.status}`);
        
        // Check for specific content
        if (url.includes('sitemap') && result.data.includes('<?xml')) {
          console.log(`   📄 Valid XML sitemap`);
        }
        if (url === '/robots.txt' && result.data.includes('Sitemap:')) {
          console.log(`   🤖 Robots.txt with sitemap references`);
        }
        if (url === '/manifest.json' && result.data.includes('"name"')) {
          console.log(`   📱 Valid web app manifest`);
        }
      } else {
        console.log(`❌ ${url} - Status: ${result.status}`);
      }
    } catch (error) {
      console.log(`❌ ${url} - Error: ${error.error}`);
      results.push(error);
    }
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`   ${successful}/${total} tests passed`);
  
  if (successful === total) {
    console.log('\n🎉 All SEO tests passed! Your site is ready for search engines.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
  
  // Recommendations
  console.log('\n📋 Next Steps:');
  console.log('1. Submit sitemaps to Google Search Console');
  console.log('2. Set up Google Analytics');
  console.log('3. Verify your site in Google Search Console');
  console.log('4. Test structured data with Google Rich Results Test');
  console.log('5. Monitor Core Web Vitals in PageSpeed Insights');
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testUrl, runTests };
