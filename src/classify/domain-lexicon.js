/**
 * Domain classification lexicon.
 *
 * Each domain has a set of weighted keyword stems. Higher weight = stronger signal.
 * Keywords are matched against normalised (lowercase) tokens from title + summary.
 *
 * Weight scale: 3 = definitive, 2 = strong signal, 1 = supporting evidence.
 *
 * These are deliberately broad: a single "war" token shouldn't force "conflict"
 * if the rest of the article is about trade policy. The classifier uses aggregate
 * scoring, not single-keyword matching.
 */

export const DOMAIN_KEYWORDS = {
  politics: new Map([
    // Governance, legislation, diplomacy, elections
    ['diplomat', 3], ['embassy', 3], ['treaty', 3], ['summit', 3], ['bilateral', 3],
    ['geopolit', 3], ['multilateral', 3], ['sovereignty', 3], ['sanctions', 2],
    ['united nations', 3], ['nato', 3], ['foreign', 2], ['minister', 1],
    ['ambassador', 3], ['border', 1], ['refugee', 2], ['asylum', 2],
    ['migration', 2], ['humanitarian', 2], ['peacekeep', 3], ['coalition', 2],
    ['alliance', 2], ['extradition', 3],
    ['congress', 3], ['parliament', 3], ['senate', 3], ['legislation', 3],
    ['lawmaker', 3], ['governor', 3], ['mayor', 2], ['election', 2],
    ['ballot', 3], ['vote', 2], ['campaign', 2], ['bipartisan', 3],
    ['democrat', 2], ['republican', 2], ['conservative', 2], ['liberal', 2],
    ['policy', 1], ['regulation', 2], ['executive order', 3], ['filibuster', 3],
    ['impeach', 3], ['partisan', 2], ['constituent', 3], ['caucus', 3],
    ['redistrict', 3], ['judiciary', 2], ['supreme court', 3], ['amendment', 2],
  ]),

  conflict: new Map([
    // War, military, violence
    ['war', 3], ['military', 2], ['army', 2], ['troops', 3], ['combat', 3],
    ['airstrike', 3], ['bombing', 3], ['missile', 3], ['weapon', 2],
    ['ceasefire', 3], ['siege', 3], ['invasion', 3], ['occupation', 3],
    ['insurgent', 3], ['militia', 3], ['terrorist', 3], ['terrorism', 3],
    ['soldier', 2], ['casualt', 3], ['killed', 2], ['warfare', 3],
    ['ammunition', 3], ['artillery', 3], ['drone strike', 3], ['offensive', 2],
    ['hostage', 3], ['kidnap', 3], ['attack', 1], ['defense', 1],
    ['battlefield', 3], ['guerrilla', 3], ['rebel', 2], ['coup', 3],
  ]),

  economy: new Map([
    // Markets, trade, finance
    ['market', 2], ['stock', 2], ['economy', 3], ['inflation', 3],
    ['recession', 3], ['gdp', 3], ['unemployment', 3], ['trade', 2],
    ['tariff', 3], ['fiscal', 3], ['monetary', 3], ['central bank', 3],
    ['interest rate', 3], ['investor', 2], ['treasury', 2], ['deficit', 3],
    ['surplus', 2], ['export', 2], ['import', 2], ['commodity', 3],
    ['cryptocurrency', 2], ['bitcoin', 2], ['wall street', 3], ['dow', 3],
    ['nasdaq', 3], ['ipo', 3], ['merger', 3], ['acquisition', 3],
    ['revenue', 2], ['profit', 2], ['startup', 2], ['venture', 2],
  ]),

  science: new Map([
    // Research, discovery, academic
    ['research', 2], ['scientist', 3], ['study', 1], ['discover', 2],
    ['experiment', 3], ['laboratory', 3], ['physicist', 3], ['biolog', 3],
    ['chemistr', 3], ['quantum', 3], ['genome', 3], ['dna', 3],
    ['fossil', 3], ['archaeolog', 3], ['paleontolog', 3], ['telescope', 3],
    ['asteroid', 3], ['planet', 2], ['nasa', 3], ['esa', 3],
    ['peer-review', 3], ['journal', 1], ['hypothesis', 3], ['theorem', 3],
    ['particle', 2], ['neuroscien', 3], ['evolution', 2], ['species', 2],
    ['satellite', 2], ['orbit', 2], ['mars', 2], ['lunar', 3],
    ['cosmic', 2], ['galaxy', 3], ['supernova', 3],
  ]),

  tech: new Map([
    // Technology, digital, AI
    ['software', 3], ['hardware', 2], ['algorithm', 3], ['artificial intelligence', 3],
    ['machine learning', 3], ['startup', 2], ['app', 1], ['silicon valley', 3],
    ['cybersecurity', 3], ['hack', 2], ['encryption', 3], ['blockchain', 3],
    ['cloud computing', 3], ['data breach', 3], ['privacy', 2], ['surveillance', 2],
    ['robot', 2], ['automat', 2], ['chip', 1], ['semiconductor', 3],
    ['processor', 2], ['google', 1], ['apple', 1], ['microsoft', 1],
    ['amazon', 1], ['meta', 1], ['openai', 3], ['chatgpt', 3],
    ['programming', 2], ['developer', 1], ['open source', 2], ['api', 2],
    ['smartphone', 2], ['virtual reality', 3], ['augmented reality', 3],
  ]),

  environment: new Map([
    // Climate, nature, energy
    ['climate', 3], ['global warming', 3], ['carbon', 2], ['emission', 3],
    ['renewable', 3], ['solar', 2], ['wind energy', 3], ['fossil fuel', 3],
    ['deforest', 3], ['biodiversity', 3], ['extinct', 3], ['conservat', 2],
    ['pollut', 3], ['ocean', 1], ['wildfire', 3], ['drought', 2],
    ['flood', 1], ['hurricane', 2], ['typhoon', 2], ['earthquake', 2],
    ['sustainable', 2], ['recycl', 2], ['greenhouse', 3], ['ozone', 3],
    ['ecosystem', 3], ['endangered', 3], ['coral', 2], ['glacier', 3],
    ['arctic', 2], ['antarctic', 2], ['permafrost', 3],
  ]),

  health: new Map([
    // Public health, medicine
    ['health', 2], ['medical', 2], ['hospital', 2], ['doctor', 1],
    ['patient', 2], ['vaccine', 3], ['pandemic', 3], ['epidemic', 3],
    ['disease', 2], ['virus', 2], ['infection', 2], ['symptom', 2],
    ['treatment', 2], ['surgery', 2], ['cancer', 3], ['diabetes', 3],
    ['mental health', 3], ['depression', 2], ['anxiety', 1], ['therapy', 2],
    ['pharmaceutical', 3], ['drug', 1], ['clinical trial', 3], ['who', 1],
    ['cdc', 3], ['diagnosis', 3], ['outbreak', 3], ['mortality', 3],
    ['wellbeing', 3], ['nutrition', 2], ['obesity', 3], ['dementia', 3],
  ]),

  culture: new Map([
    // Arts, media, society, education
    ['film', 2], ['movie', 2], ['music', 2], ['album', 2],
    ['artist', 2], ['gallery', 2], ['museum', 2], ['theater', 2],
    ['theatre', 2], ['novel', 2], ['book', 1], ['author', 2],
    ['festival', 2], ['concert', 2], ['oscar', 3], ['grammy', 3],
    ['emmy', 3], ['education', 2], ['university', 1], ['school', 1],
    ['religion', 2], ['church', 1], ['mosque', 1], ['temple', 1],
    ['cultural', 2], ['heritage', 2], ['tradition', 2], ['celebrity', 2],
    ['television', 1], ['streaming', 1], ['exhibit', 2], ['architect', 2],
  ]),

  sports: new Map([
    // Athletics
    ['football', 2], ['soccer', 3], ['basketball', 3], ['tennis', 3],
    ['cricket', 3], ['olympic', 3], ['champion', 2], ['tournament', 2],
    ['league', 2], ['match', 1], ['coach', 1], ['athlete', 3],
    ['stadium', 2], ['goal', 1], ['score', 1], ['playoff', 3],
    ['world cup', 3], ['medal', 2], ['rugby', 3], ['baseball', 3],
    ['nfl', 3], ['nba', 3], ['fifa', 3], ['transfer', 1],
  ]),

  human: new Map([
    // Human interest
    ['community', 2], ['volunteer', 3], ['charity', 2], ['rescue', 2],
    ['survivor', 2], ['reunion', 2], ['inspire', 2], ['overcome', 2],
    ['heroic', 3], ['compassion', 3], ['kindness', 3], ['milestone', 2],
    ['centenarian', 3], ['fundrais', 3], ['mentor', 2], ['gratitude', 3],
    ['neighbor', 2], ['neighbourhood', 2], ['story', 1], ['journey', 1],
    ['family', 1], ['children', 1], ['tradition', 1],
  ]),

  meta: new Map([
    // Media about media
    ['journalism', 3], ['journalist', 3], ['press freedom', 3], ['media', 2],
    ['misinformation', 3], ['disinformation', 3], ['propaganda', 3],
    ['fact-check', 3], ['censorship', 3], ['editorial', 2], ['newsroom', 3],
    ['reporter', 2], ['whistleblower', 3], ['leak', 1], ['transparency', 2],
    ['social media', 2], ['platform', 1], ['algorithm', 1], ['content moderation', 3],
  ]),
};
