/**
 * Newsy Cognitive Taxonomy — domains and registers.
 *
 * Domains describe WHAT an article is about.
 * Registers describe what COGNITIVE MODE it invites.
 *
 * Together they answer: "What does this story cost me mentally?"
 */

export const DOMAINS = {
  conflict:    { label: 'conflict',    description: 'War, military, terrorism, civil unrest' },
  politics:    { label: 'politics',    description: 'Governance, legislation, diplomacy, elections' },
  economy:     { label: 'economy',     description: 'Markets, trade, employment, central banking' },
  science:     { label: 'science',     description: 'Research, discovery, academic, medical' },
  tech:        { label: 'tech',        description: 'Technology industry, digital, AI, cyber' },
  environment: { label: 'environment', description: 'Climate, nature, energy, sustainability' },
  health:      { label: 'health',      description: 'Public health, medicine, pandemic, wellbeing' },
  culture:     { label: 'culture',     description: 'Arts, media, society, education, religion' },
  sports:      { label: 'sports',      description: 'Athletic events, competitions' },
  human:       { label: 'human',       description: 'Human interest, profiles, community stories' },
  meta:        { label: 'meta',        description: 'Media about media, press freedom, information' },
};

export const REGISTERS = {
  alert:      { label: 'alert',      description: 'Breaking, urgent, developing',       cost: 'high' },
  concern:    { label: 'concern',    description: 'Crisis, suffering, threat',           cost: 'high' },
  analysis:   { label: 'analysis',   description: 'Explainer, opinion, deep context',   cost: 'medium' },
  awareness:  { label: 'awareness',  description: 'Informational, factual update',      cost: 'low' },
  curiosity:  { label: 'curiosity',  description: 'Discovery, innovation, positive',    cost: 'low' },
  reflection: { label: 'reflection', description: 'Long-form, historical, philosophical', cost: 'medium' },
};

export const DOMAIN_KEYS = Object.keys(DOMAINS);
export const REGISTER_KEYS = Object.keys(REGISTERS);
