/**
 * English lexicon — AFINN-165 subset + arousal terms.
 *
 * AFINN-165 scores words from -5 (most negative) to +5 (most positive).
 * This is a curated subset covering common news vocabulary.
 * Full AFINN-165 has ~3,382 entries — this can be expanded or replaced
 * with the full dataset via npm `afinn-165` package.
 *
 * Arousal terms: words that indicate high emotional intensity in news.
 */

const sentiment = new Map([
  // strongly negative (-5 to -3)
  ['catastrophe', -4], ['catastrophic', -4], ['massacre', -5], ['murder', -4],
  ['terrorist', -4], ['terrorism', -4], ['genocide', -5], ['devastating', -4],
  ['horrific', -4], ['atrocity', -5], ['slaughter', -5], ['assassination', -4],
  ['explosion', -3], ['bomb', -3], ['bombing', -4], ['killed', -3],
  ['deaths', -3], ['dead', -3], ['die', -3], ['dying', -3],
  ['destroy', -3], ['destroyed', -3], ['destruction', -3], ['collapse', -3],
  ['crisis', -3], ['disaster', -3], ['emergency', -3], ['fatal', -3],
  ['victim', -3], ['victims', -3], ['violent', -3], ['violence', -3],
  ['war', -3], ['warfare', -3], ['conflict', -3],

  // moderately negative (-2 to -1)
  ['attack', -2], ['threat', -2], ['threatening', -2], ['fear', -2],
  ['fears', -2], ['angry', -2], ['anger', -2], ['outrage', -2],
  ['outraged', -2], ['protest', -1], ['protests', -1], ['arrest', -2],
  ['arrested', -2], ['corruption', -2], ['corrupt', -2], ['fraud', -2],
  ['scandal', -2], ['controversial', -1], ['controversy', -1],
  ['blame', -2], ['accused', -2], ['guilty', -2], ['crime', -2],
  ['criminal', -2], ['recession', -2], ['unemployment', -2],
  ['poverty', -2], ['suffer', -2], ['suffering', -2], ['injury', -2],
  ['injured', -2], ['damage', -2], ['damaged', -2], ['fail', -2],
  ['failed', -2], ['failure', -2], ['decline', -1], ['loss', -1],
  ['losing', -1], ['lost', -1], ['risk', -1], ['concern', -1],
  ['concerns', -1], ['worried', -1], ['worry', -1], ['tension', -1],
  ['tensions', -1], ['dispute', -1], ['warning', -1], ['warned', -1],
  ['strike', -1], ['shortage', -1], ['deficit', -1], ['debt', -1],

  // neutral-ish
  ['negotiate', 0], ['negotiations', 0], ['election', 0], ['vote', 0],

  // moderately positive (+1 to +2)
  ['agree', 1], ['agreed', 1], ['agreement', 1], ['peace', 2],
  ['peaceful', 2], ['support', 1], ['supported', 1], ['improve', 1],
  ['improved', 1], ['improvement', 1], ['grow', 1], ['growth', 1],
  ['recover', 1], ['recovery', 1], ['success', 2], ['successful', 2],
  ['progress', 1], ['hope', 1], ['hopeful', 1], ['benefit', 1],
  ['safe', 1], ['safety', 1], ['protect', 1], ['protection', 1],
  ['rescue', 2], ['rescued', 2], ['aid', 1], ['relief', 1],
  ['stable', 1], ['stability', 1], ['reform', 1], ['solution', 1],
  ['resolve', 1], ['resolved', 1], ['cooperation', 2], ['cooperate', 1],
  ['invest', 1], ['investment', 1], ['opportunity', 1], ['win', 2],
  ['won', 2], ['victory', 2],

  // strongly positive (+3 to +5)
  ['breakthrough', 3], ['celebrate', 3], ['celebration', 3],
  ['triumph', 3], ['excellent', 3], ['outstanding', 4],
  ['remarkable', 3], ['extraordinary', 3], ['miracle', 4],
  ['discover', 2], ['discovery', 3], ['innovation', 3],
  ['liberate', 3], ['liberation', 3], ['freedom', 3],
]);

const arousal = new Set([
  'breaking', 'urgent', 'emergency', 'crisis', 'catastrophe', 'catastrophic',
  'massacre', 'murder', 'terrorist', 'terrorism', 'explosion', 'bomb',
  'bombing', 'killed', 'attack', 'war', 'warfare', 'shooting',
  'assassination', 'genocide', 'slaughter', 'riot', 'riots',
  'violent', 'violence', 'death', 'deaths', 'dead', 'fatal',
  'devastating', 'destruction', 'destroy', 'destroyed', 'collapse',
  'outrage', 'outraged', 'fury', 'furious', 'panic', 'shock',
  'shocking', 'horrific', 'horror', 'threat', 'threatening',
  'danger', 'dangerous', 'flee', 'fleeing', 'evacuate', 'evacuation',
]);

export const en = { sentiment, arousal };
