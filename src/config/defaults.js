/**
 * Default configuration values.
 * See: .idea/newsy0.1.md §4.7, §5
 */

export const DEFAULT_CONFIG = {
  maxReadTimeMin: 15,
  maxArousalLoad: 0.6,
  mode: 'overview',
  fetchTimeoutMs: 10000,
  wordsPerMinute: 225,
  deduplicationThreshold: 0.92,
  clusterThreshold: 0.75,
};

export const MODES = {
  calm: {
    includeBreaking: false,
    maxClusterSizeExpansion: 1,
    arousalThreshold: 0.3,
    summaryOnly: true,
    topicWhitelist: null,
    topicBlacklist: null,
  },
  overview: {
    includeBreaking: true,
    maxClusterSizeExpansion: 1,
    arousalThreshold: 0.6,
    summaryOnly: false,
    topicWhitelist: null,
    topicBlacklist: null,
  },
  deep: {
    includeBreaking: true,
    maxClusterSizeExpansion: 5,
    arousalThreshold: 0.9,
    summaryOnly: false,
    topicWhitelist: null,
    topicBlacklist: null,
  },
  monitoring: {
    includeBreaking: true,
    maxClusterSizeExpansion: 1,
    arousalThreshold: 1.0,
    summaryOnly: true,
    topicWhitelist: null,
    topicBlacklist: null,
  },
  slow: {
    includeBreaking: false,
    maxClusterSizeExpansion: 1,
    arousalThreshold: 0.5,
    summaryOnly: false,
    topicWhitelist: null,
    topicBlacklist: null,
  },
};
