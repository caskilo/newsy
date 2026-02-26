/**
 * Default RSS sources — a curated starting set.
 * These can be modified at runtime via addSource/removeSource.
 *
 * SourceRecord fields:
 *   id              string    unique slug
 *   name            string    display name
 *   rssUrl          string    feed URL
 *   enabled         boolean   active in pipeline
 *   fetchIntervalMin number   polling interval
 *   country         string    ISO-ish label or 'international'
 *   category        string    news | science | tech | business | sports | culture | opinion
 *   language        string    ISO 639-1 code (en, fr, de, etc.)
 *   lastTestResult  object?   result from feed-tester (populated at runtime)
 */

export const SOURCE_CATEGORIES = [
  'news', 'science', 'tech', 'business', 'sports', 'culture', 'opinion', 'other',
];

export const DEFAULT_SOURCES = [
  {
    id: 'bbc-world',
    name: 'BBC News - World',
    rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    enabled: true,
    fetchIntervalMin: 30,
    country: 'uk',
    category: 'news',
    language: 'en',
  },
  {
    id: 'guardian-world',
    name: 'The Guardian - World',
    rssUrl: 'https://www.theguardian.com/world/rss',
    enabled: true,
    fetchIntervalMin: 30,
    country: 'uk',
    category: 'news',
    language: 'en',
  },
  {
    id: 'npr-news',
    name: 'NPR News',
    rssUrl: 'https://feeds.npr.org/1001/rss.xml',
    enabled: true,
    fetchIntervalMin: 30,
    country: 'us',
    category: 'news',
    language: 'en',
  },
  {
    id: 'al-jazeera',
    name: 'Al Jazeera',
    rssUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    enabled: true,
    fetchIntervalMin: 30,
    country: 'international',
    category: 'news',
    language: 'en',
  },
  {
    id: 'nyt-world',
    name: 'New York Times - World',
    rssUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    enabled: true,
    fetchIntervalMin: 30,
    country: 'us',
    category: 'news',
    language: 'en',
  },
  {
    id: 'bbc-science',
    name: 'BBC Science & Environment',
    rssUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    enabled: false,
    fetchIntervalMin: 60,
    country: 'uk',
    category: 'science',
    language: 'en',
  },
  {
    id: 'nature',
    name: 'Nature',
    rssUrl: 'https://www.nature.com/nature.rss',
    enabled: false,
    fetchIntervalMin: 60,
    country: 'international',
    category: 'science',
    language: 'en',
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica',
    rssUrl: 'https://feeds.arstechnica.com/arstechnica/index',
    enabled: false,
    fetchIntervalMin: 60,
    country: 'us',
    category: 'tech',
    language: 'en',
  },
  {
    id: 'hacker-news',
    name: 'Hacker News',
    rssUrl: 'https://news.ycombinator.com/rss',
    enabled: false,
    fetchIntervalMin: 30,
    country: 'international',
    category: 'tech',
    language: 'en',
  },
  {
    id: 'france24-en',
    name: 'France 24',
    rssUrl: 'https://www.france24.com/en/rss',
    enabled: false,
    fetchIntervalMin: 30,
    country: 'fr',
    category: 'news',
    language: 'en',
  },
  {
    id: 'cnn-world',
    name: 'CNN World',
    rssUrl: 'http://rss.cnn.com/rss/edition_world.rss',
    enabled: false,
    fetchIntervalMin: 30,
    country: 'us',
    category: 'news',
    language: 'en',
  },
  {
    id: 'wapo-world',
    name: 'Washington Post - World',
    rssUrl: 'http://feeds.washingtonpost.com/rss/world',
    enabled: false,
    fetchIntervalMin: 30,
    country: 'us',
    category: 'news',
    language: 'en',
  },
  {
    id: 'sciencedaily',
    name: 'ScienceDaily',
    rssUrl: 'https://www.sciencedaily.com/rss/all.xml',
    enabled: false,
    fetchIntervalMin: 60,
    country: 'international',
    category: 'science',
    language: 'en',
  },
  {
    id: 'the-verge',
    name: 'The Verge',
    rssUrl: 'https://www.theverge.com/rss/index.xml',
    enabled: false,
    fetchIntervalMin: 30,
    country: 'us',
    category: 'tech',
    language: 'en',
  },
];
