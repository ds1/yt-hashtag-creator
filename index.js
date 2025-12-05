// YT-Hashtag-Creator MCP Server
// Creates trending and relevant YouTube hashtags for video discovery

const WebSocket = require('ws');

class YTHashtagCreator {
  constructor() {
    this.name = 'YT-Hashtag-Creator';
    this.version = '1.0.0';
    this.capabilities = ['youtube', 'hashtags', 'trending', 'discovery'];
    this.port = process.env.PORT || 3000;

    // YouTube hashtag constraints
    this.constraints = {
      maxHashtags: 15, // YouTube allows up to 15
      recommendedCount: { min: 3, max: 5 }, // YouTube shows first 3 above title
      maxLength: 100, // Max characters per hashtag
      aboveTitle: 3 // First 3 hashtags appear above the title
    };

    // Trending hashtag patterns by niche
    this.nicheHashtags = {
      tech: ['#tech', '#technology', '#gadgets', '#innovation', '#techtips'],
      gaming: ['#gaming', '#gamer', '#gameplay', '#videogames', '#letsplay'],
      education: ['#education', '#learning', '#tutorial', '#howto', '#study'],
      lifestyle: ['#lifestyle', '#life', '#daily', '#vlog', '#motivation'],
      business: ['#business', '#entrepreneur', '#success', '#money', '#marketing'],
      fitness: ['#fitness', '#workout', '#gym', '#health', '#exercise'],
      cooking: ['#cooking', '#recipe', '#food', '#foodie', '#chef'],
      music: ['#music', '#musician', '#song', '#newmusic', '#musicvideo'],
      beauty: ['#beauty', '#makeup', '#skincare', '#beautytips', '#tutorial'],
      travel: ['#travel', '#adventure', '#wanderlust', '#explore', '#vacation']
    };

    // Universal trending hashtags
    this.universalHashtags = ['#youtube', '#viral', '#trending', '#fyp', '#subscribe'];
  }

  start() {
    const wss = new WebSocket.Server({ port: this.port });

    wss.on('connection', (ws) => {
      console.log(`[${new Date().toISOString()}] Client connected`);

      ws.on('message', async (message) => {
        try {
          const request = JSON.parse(message.toString());
          console.log(`[${new Date().toISOString()}] Received:`, request.method);

          const response = await this.handleRequest(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          console.error('Error processing message:', error);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error' },
            id: null
          }));
        }
      });

      ws.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected`);
      });
    });

    console.log(`🚀 ${this.name} MCP server running on port ${this.port}`);

    if (process.env.REPLIT_ENVIRONMENT === 'production') {
      console.log(`📡 Published WebSocket URL: wss://yt-hashtag-creator-agt.replit.app`);
    } else {
      console.log(`📡 Dev WebSocket URL: ws://localhost:${this.port}`);
    }
  }

  async handleRequest(request) {
    const { method, params, id } = request;

    switch(method) {
      case 'ping':
        return this.handlePing(id);

      case 'tools/list':
        return this.handleToolsList(id);

      case 'tools/call':
        return await this.handleToolCall(params, id);

      default:
        return {
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${method}` },
          id
        };
    }
  }

  handlePing(id) {
    return {
      jsonrpc: '2.0',
      result: {
        status: 'ok',
        agent: this.name,
        version: this.version,
        timestamp: new Date().toISOString()
      },
      id
    };
  }

  handleToolsList(id) {
    return {
      jsonrpc: '2.0',
      result: {
        tools: [
          {
            name: 'createHashtags',
            description: 'Create optimized YouTube hashtags for video discovery',
            inputSchema: {
              type: 'object',
              properties: {
                concept: {
                  type: 'string',
                  description: 'The video concept/topic'
                },
                title: {
                  type: 'string',
                  description: 'The video title'
                },
                keywords: {
                  type: 'object',
                  description: 'Keywords data from analyzer'
                },
                niche: {
                  type: 'string',
                  enum: ['tech', 'gaming', 'education', 'lifestyle', 'business', 'fitness', 'cooking', 'music', 'beauty', 'travel', 'other'],
                  description: 'Content niche'
                },
                contentStyle: {
                  type: 'string',
                  enum: ['tutorial', 'review', 'vlog', 'entertainment', 'educational', 'shorts'],
                  description: 'Type of content'
                },
                targetAudience: {
                  type: 'string',
                  description: 'Target audience'
                },
                maxHashtags: {
                  type: 'number',
                  default: 5,
                  description: 'Maximum hashtags to generate (recommended: 3-5)'
                },
                prioritizeTrending: {
                  type: 'boolean',
                  default: true,
                  description: 'Prioritize trending hashtags'
                }
              },
              required: ['concept']
            }
          }
        ]
      },
      id
    };
  }

  async handleToolCall(params, id) {
    const { name, arguments: args } = params;

    if (name !== 'createHashtags') {
      return {
        jsonrpc: '2.0',
        error: { code: -32602, message: `Unknown tool: ${name}` },
        id
      };
    }

    try {
      const result = await this.createHashtags(args);
      return {
        jsonrpc: '2.0',
        result: {
          content: result
        },
        id
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message },
        id
      };
    }
  }

  async createHashtags({
    concept,
    title,
    keywords,
    niche = 'other',
    contentStyle = 'tutorial',
    targetAudience,
    maxHashtags = 5,
    prioritizeTrending = true
  }) {
    if (!concept) {
      throw new Error('Concept is required');
    }

    console.log(`Creating hashtags for: "${concept}"`);

    const allHashtags = [];

    // Extract keywords
    const primaryKeywords = keywords?.recommended?.primary || [];
    const secondaryKeywords = keywords?.recommended?.secondary || [];

    // 1. Topic-specific hashtags (highest priority for above-title placement)
    const topicHashtags = this.generateTopicHashtags(concept, title);
    allHashtags.push(...topicHashtags);

    // 2. Keyword-based hashtags
    const keywordHashtags = this.generateKeywordHashtags(primaryKeywords, secondaryKeywords);
    allHashtags.push(...keywordHashtags);

    // 3. Niche hashtags
    const nicheHashtags = this.generateNicheHashtags(niche);
    allHashtags.push(...nicheHashtags);

    // 4. Content style hashtags
    const styleHashtags = this.generateStyleHashtags(contentStyle);
    allHashtags.push(...styleHashtags);

    // 5. Trending/viral hashtags
    if (prioritizeTrending) {
      const trendingHashtags = this.generateTrendingHashtags(concept);
      allHashtags.push(...trendingHashtags);
    }

    // 6. Audience-specific hashtags
    if (targetAudience) {
      const audienceHashtags = this.generateAudienceHashtags(targetAudience);
      allHashtags.push(...audienceHashtags);
    }

    // Deduplicate and sort by priority
    const uniqueHashtags = this.deduplicateHashtags(allHashtags);
    uniqueHashtags.sort((a, b) => b.priority - a.priority);

    // Select top hashtags
    const selectedHashtags = uniqueHashtags.slice(0, Math.min(maxHashtags, this.constraints.maxHashtags));

    // Separate above-title and description hashtags
    const aboveTitle = selectedHashtags.slice(0, this.constraints.aboveTitle);
    const inDescription = selectedHashtags.slice(this.constraints.aboveTitle);

    return {
      concept,
      niche,
      contentStyle,
      generatedAt: new Date().toISOString(),
      hashtags: selectedHashtags,
      placement: {
        aboveTitle: {
          hashtags: aboveTitle,
          formatted: aboveTitle.map(h => h.hashtag).join(' '),
          note: 'These 3 hashtags will appear above your video title'
        },
        inDescription: {
          hashtags: inDescription,
          formatted: inDescription.map(h => h.hashtag).join(' '),
          note: 'Add these to your description for additional discovery'
        }
      },
      allHashtags: selectedHashtags.map(h => h.hashtag),
      formatted: {
        spaced: selectedHashtags.map(h => h.hashtag).join(' '),
        newline: selectedHashtags.map(h => h.hashtag).join('\n'),
        comma: selectedHashtags.map(h => h.hashtag).join(', ')
      },
      statistics: {
        total: selectedHashtags.length,
        byType: this.countByType(selectedHashtags),
        averageLength: Math.round(
          selectedHashtags.reduce((sum, h) => sum + h.hashtag.length, 0) / selectedHashtags.length
        )
      },
      recommendations: this.generateRecommendations(selectedHashtags, niche),
      tips: [
        'First 3 hashtags appear above your video title - make them count!',
        'Use a mix of popular and niche-specific hashtags',
        'Avoid overused hashtags like #fyp unless relevant',
        'Hashtags in the title can look spammy - keep them in description',
        'Update hashtags based on trending topics for better discovery',
        'YouTube allows up to 15 hashtags, but 3-5 is optimal'
      ]
    };
  }

  generateTopicHashtags(concept, title) {
    const hashtags = [];
    const conceptClean = concept.toLowerCase().replace(/[^\w\s]/g, '');

    // Main concept as hashtag
    const mainHashtag = '#' + conceptClean.replace(/\s+/g, '');
    if (mainHashtag.length <= 30) {
      hashtags.push({
        hashtag: mainHashtag,
        type: 'topic',
        priority: 100,
        reason: 'Main video topic'
      });
    }

    // Concept words
    const words = conceptClean.split(' ').filter(w => w.length > 3);
    words.slice(0, 2).forEach((word, index) => {
      hashtags.push({
        hashtag: '#' + word,
        type: 'topic',
        priority: 90 - index * 5,
        reason: 'Topic keyword'
      });
    });

    // Title-based (if provided)
    if (title) {
      const titleWords = title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(' ')
        .filter(w => w.length > 4);

      titleWords.slice(0, 2).forEach((word, index) => {
        const hashtag = '#' + word;
        if (!hashtags.some(h => h.hashtag === hashtag)) {
          hashtags.push({
            hashtag,
            type: 'topic',
            priority: 85 - index * 5,
            reason: 'Title keyword'
          });
        }
      });
    }

    return hashtags;
  }

  generateKeywordHashtags(primaryKeywords, secondaryKeywords) {
    const hashtags = [];

    // Primary keywords
    primaryKeywords.slice(0, 3).forEach((kw, index) => {
      const hashtag = '#' + kw.keyword.toLowerCase().replace(/\s+/g, '');
      if (hashtag.length <= 30 && hashtag.length >= 3) {
        hashtags.push({
          hashtag,
          type: 'keyword',
          priority: 80 - index * 5,
          reason: 'Primary keyword'
        });
      }
    });

    // Secondary keywords
    secondaryKeywords.slice(0, 2).forEach((kw, index) => {
      const hashtag = '#' + kw.keyword.toLowerCase().replace(/\s+/g, '');
      if (hashtag.length <= 30 && hashtag.length >= 3) {
        hashtags.push({
          hashtag,
          type: 'keyword',
          priority: 65 - index * 5,
          reason: 'Secondary keyword'
        });
      }
    });

    return hashtags;
  }

  generateNicheHashtags(niche) {
    const hashtags = [];
    const nicheList = this.nicheHashtags[niche] || [];

    nicheList.slice(0, 3).forEach((tag, index) => {
      hashtags.push({
        hashtag: tag,
        type: 'niche',
        priority: 70 - index * 5,
        reason: `${niche} niche hashtag`
      });
    });

    return hashtags;
  }

  generateStyleHashtags(contentStyle) {
    const styleMap = {
      tutorial: ['#tutorial', '#howto', '#learn', '#stepbystep'],
      review: ['#review', '#honest', '#productreview', '#unboxing'],
      vlog: ['#vlog', '#dailyvlog', '#vlogger', '#dayinmylife'],
      entertainment: ['#entertainment', '#fun', '#comedy', '#funny'],
      educational: ['#education', '#educational', '#learning', '#facts'],
      shorts: ['#shorts', '#youtubeshorts', '#short', '#viral']
    };

    const hashtags = [];
    const styleTags = styleMap[contentStyle] || [];

    styleTags.slice(0, 2).forEach((tag, index) => {
      hashtags.push({
        hashtag: tag,
        type: 'style',
        priority: 60 - index * 5,
        reason: `${contentStyle} content style`
      });
    });

    return hashtags;
  }

  generateTrendingHashtags(concept) {
    const hashtags = [];
    const year = new Date().getFullYear();

    // Year hashtag
    hashtags.push({
      hashtag: `#${year}`,
      type: 'trending',
      priority: 55,
      reason: 'Current year'
    });

    // Concept + year
    const conceptYear = '#' + concept.toLowerCase().replace(/\s+/g, '') + year;
    if (conceptYear.length <= 30) {
      hashtags.push({
        hashtag: conceptYear,
        type: 'trending',
        priority: 50,
        reason: 'Topic + year trend'
      });
    }

    // Universal trending
    hashtags.push({
      hashtag: '#viral',
      type: 'trending',
      priority: 45,
      reason: 'Viral discovery'
    });

    return hashtags;
  }

  generateAudienceHashtags(targetAudience) {
    const hashtags = [];
    const audienceClean = targetAudience.toLowerCase().replace(/[^\w\s]/g, '');

    hashtags.push({
      hashtag: '#' + audienceClean.replace(/\s+/g, ''),
      type: 'audience',
      priority: 50,
      reason: `Target audience: ${targetAudience}`
    });

    // Common audience modifiers
    const modifiers = ['for', 'tips'];
    modifiers.forEach((mod, index) => {
      const hashtag = '#' + audienceClean.split(' ')[0] + mod;
      if (hashtag.length <= 25) {
        hashtags.push({
          hashtag,
          type: 'audience',
          priority: 45 - index * 5,
          reason: 'Audience modifier'
        });
      }
    });

    return hashtags;
  }

  deduplicateHashtags(hashtags) {
    const seen = new Set();
    return hashtags.filter(h => {
      const normalized = h.hashtag.toLowerCase();
      if (seen.has(normalized)) return false;
      if (normalized.length < 3 || normalized.length > 100) return false;
      seen.add(normalized);
      return true;
    });
  }

  countByType(hashtags) {
    const counts = {};
    hashtags.forEach(h => {
      counts[h.type] = (counts[h.type] || 0) + 1;
    });
    return counts;
  }

  generateRecommendations(hashtags, niche) {
    const recommendations = [];
    const types = this.countByType(hashtags);

    if (hashtags.length < 3) {
      recommendations.push('Add at least 3 hashtags for optimal visibility above your title');
    }

    if (!types.topic) {
      recommendations.push('Include hashtags specific to your video topic');
    }

    if (!types.niche && niche !== 'other') {
      recommendations.push(`Add ${niche}-specific hashtags to reach your target audience`);
    }

    if (!types.trending) {
      recommendations.push('Consider adding trending hashtags for broader discovery');
    }

    if (hashtags.length > 5) {
      recommendations.push('You have more than 5 hashtags - ensure the best 3 are listed first');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your hashtags are well-balanced for discovery!');
    }

    return recommendations;
  }
}

// Start the server
const server = new YTHashtagCreator();
server.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing WebSocket server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing WebSocket server');
  process.exit(0);
});
