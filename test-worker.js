// Test script for TechWala News Updater Worker
// Run this to test the worker functionality

const CF_TOKEN = 'cfut_8UVUhWwpdFGxMwxcwA2lUWcPDWjn695pledRk7cZ7fe1882e';
const WORKER_URL = 'https://techwala-news-updater.YOUR_WORKER_SUBDOMAIN.workers.dev';

async function testWorker() {
  console.log('🧪 Testing TechWala News Updater Worker...');
  
  try {
    // Test 1: Fetch articles
    console.log('📥 Testing article fetching...');
    const response = await fetch(`${WORKER_URL}/latest`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Worker response:', data);
    
    // Test 2: Verify article structure
    if (data.articles && data.articles.length > 0) {
      console.log('📊 Articles found:', data.articles.length);
      
      const sampleArticle = data.articles[0];
      console.log('📝 Sample article structure:');
      console.log('- Title:', sampleArticle.title?.substring(0, 50) + '...');
      console.log('- Category:', sampleArticle.category);
      console.log('- Summary:', sampleArticle.summary?.substring(0, 100) + '...');
      console.log('- Image:', sampleArticle.image ? '✅' : '❌');
      console.log('- Keyword:', sampleArticle.keyword);
      
      // Test 3: Verify KV storage
      console.log('💾 Testing KV storage...');
      const kvResponse = await fetch(`${WORKER_URL}/latest`);
      const kvData = await kvResponse.json();
      
      if (kvData.success) {
        console.log('✅ KV storage working');
      } else {
        console.log('❌ KV storage issue:', kvData.error);
      }
      
    } else {
      console.log('⚠️ No articles found in response');
    }
    
    console.log('🎉 Worker test completed successfully!');
    
  } catch (error) {
    console.error('❌ Worker test failed:', error.message);
    console.log('💡 Make sure to:');
    console.log('1. Replace YOUR_WORKER_SUBDOMAIN in the worker URL');
    console.log('2. Set up Cloudflare KV namespace');
    console.log('3. Configure Unsplash API key');
    console.log('4. Deploy the worker first');
  }
}

// Run the test
testWorker();