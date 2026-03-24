// TechWala News Updater - Cloudflare Worker
// Fetches latest articles and updates KV storage

const AI_ENDPOINT = 'https://api.cloudflare.com/client/v4/accounts/9124f19851c7c5ce9c0ab0c310e2e2df/ai/run/kimi-k2.5';
const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY'; // Replace with actual key
const KV_NAMESPACE = 'TECHWALA_ARTICLES';

// RSS feed URLs
const FEEDS = [
  'https://techcrunch.com/feed/',
  'https://feeds.feedburner.com/TheHackersNews'
];

class ArticleProcessor {
  constructor() {
    this.articles = [];
  }

  async fetchRSSFeed(url) {
    try {
      const response = await fetch(url);
      const xml = await response.text();
      return this.parseRSS(xml);
    } catch (error) {
      console.error(`Error fetching RSS from ${url}:`, error);
      return [];
    }
  }

  parseRSS(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');
    
    return Array.from(items).slice(0, 5).map(item => ({
      title: item.querySelector('title')?.textContent || '',
      link: item.querySelector('link')?.textContent || '',
      description: item.querySelector('description')?.textContent || '',
      pubDate: item.querySelector('pubDate')?.textContent || '',
      guid: item.querySelector('guid')?.textContent || ''
    }));
  }

  async generateAIContent(article) {
    try {
      const prompt = `
        Analyze this article and provide:
        1. A 3-sentence summary
        2. SEO optimized title (max 60 characters)
        3. Best category tag (AI Tools, Security, Gadgets, Reviews, Earn Online, News, Transportation, Apple, Energy)
        4. Single keyword for image search
        
        Article: ${article.title}
        Description: ${article.description}
        
        Respond in JSON format:
        {
          "summary": "3-sentence summary",
          "seoTitle": "SEO optimized title",
          "category": "category tag",
          "keyword": "image search keyword"
        }
      `;

      const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const result = await response.json();
      const content = JSON.parse(result.result.response);
      
      return {
        ...article,
        summary: content.summary,
        seoTitle: content.seoTitle,
        category: content.category,
        keyword: content.keyword,
        image: await this.fetchUnsplashImage(content.keyword)
      };
    } catch (error) {
      console.error('AI generation error:', error);
      return {
        ...article,
        summary: article.description.substring(0, 200) + '...',
        seoTitle: article.title,
        category: 'News',
        keyword: 'technology',
        image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800'
      };
    }
  }

  async fetchUnsplashImage(keyword) {
    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=1`, {
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      });
      
      const data = await response.json();
      return data.results[0]?.urls?.regular || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';
    } catch (error) {
      console.error('Unsplash fetch error:', error);
      return 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800';
    }
  }

  async processAllArticles() {
    const allArticles = [];
    
    for (const feed of FEEDS) {
      const articles = await this.fetchRSSFeed(feed);
      allArticles.push(...articles);
    }
    
    // Take top 10 articles
    const topArticles = allArticles.slice(0, 10);
    
    // Process each article with AI
    for (const article of topArticles) {
      const processed = await this.generateAIContent(article);
      this.articles.push(processed);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return this.articles;
  }

  async saveToKV(articles) {
    try {
      const kv = await env.KV_NAMESPACE.get('latest_articles');
      const existingArticles = kv ? JSON.parse(kv) : [];
      
      // Keep only the latest 20 articles
      const updatedArticles = [...articles, ...existingArticles].slice(0, 20);
      
      await env.KV_NAMESPACE.put('latest_articles', JSON.stringify(updatedArticles));
      console.log('Saved', updatedArticles.length, 'articles to KV');
    } catch (error) {
      console.error('KV save error:', error);
    }
  }
}

export default {
  async fetch(request, env, ctx) {
    const processor = new ArticleProcessor();
    
    try {
      console.log('Starting TechWala news update...');
      
      // Process all articles
      const articles = await processor.processAllArticles();
      
      // Save to KV
      await processor.saveToKV(articles);
      
      return new Response(JSON.stringify({
        success: true,
        articles: articles.length,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Cron job trigger
  async scheduled(event, env, ctx) {
    console.log('Cron job triggered for TechWala news update');
    
    const processor = new ArticleProcessor();
    const articles = await processor.processAllArticles();
    await processor.saveToKV(articles);
    
    console.log('Cron job completed successfully');
  }
};