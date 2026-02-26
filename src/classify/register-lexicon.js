/**
 * Register classification lexicon.
 *
 * Registers describe the cognitive mode an article invites:
 * what kind of mental energy it demands from the reader.
 *
 * Weight scale: 3 = definitive, 2 = strong signal, 1 = supporting.
 */

export const REGISTER_KEYWORDS = {
  alert: new Map([
    // Breaking, urgent, developing — demands attention NOW
    ['breaking', 3], ['urgent', 3], ['developing', 3], ['just in', 3],
    ['alert', 3], ['emergency', 3], ['evacuate', 3], ['imminent', 3],
    ['live update', 3], ['happening now', 3], ['confirmed', 2],
    ['declares', 2], ['unfolding', 3], ['flash', 2], ['latest', 1],
    ['update', 1], ['announced', 1], ['escalat', 2],
  ]),

  concern: new Map([
    // Crisis, suffering, threat — carries emotional weight
    ['crisis', 3], ['victim', 3], ['killed', 3], ['dead', 3], ['death', 2],
    ['suffer', 3], ['tragic', 3], ['devastat', 3], ['catastroph', 3],
    ['horror', 3], ['disaster', 3], ['famine', 3], ['massacre', 3],
    ['abuse', 3], ['injustice', 3], ['poverty', 2], ['starvation', 3],
    ['torture', 3], ['genocide', 3], ['atrocity', 3], ['outrage', 3],
    ['condemn', 2], ['mourn', 3], ['grief', 3], ['fear', 2],
    ['threat', 2], ['danger', 2], ['risk', 1], ['warn', 2],
    ['collapse', 2], ['destroy', 2], ['worsen', 2], ['plunge', 2],
  ]),

  analysis: new Map([
    // Explainer, opinion, deep context — demands thought
    ['analysis', 3], ['opinion', 3], ['editorial', 3], ['commentary', 3],
    ['explainer', 3], ['explained', 2], ['perspective', 3], ['argument', 2],
    ['debate', 2], ['implication', 3], ['consequence', 2], ['context', 2],
    ['deep dive', 3], ['long read', 3], ['investigat', 3], ['examin', 2],
    ['assess', 2], ['evaluat', 2], ['interpret', 3], ['critic', 2],
    ['review', 1], ['strategy', 2], ['outlook', 2], ['forecast', 2],
    ['why', 1], ['how', 1], ['meaning', 2], ['significance', 3],
  ]),

  awareness: new Map([
    // Informational, factual update — low cognitive friction
    ['report', 1], ['announce', 2], ['confirm', 1], ['statement', 2],
    ['release', 1], ['publish', 1], ['data', 1], ['survey', 2],
    ['poll', 2], ['figure', 1], ['statistic', 2], ['percent', 1],
    ['accord', 1], ['schedule', 1], ['plan', 1], ['appoint', 2],
    ['meet', 1], ['agree', 1], ['sign', 1], ['launch', 1],
  ]),

  curiosity: new Map([
    // Discovery, innovation, positive — energising
    ['discover', 3], ['breakthrough', 3], ['invent', 3], ['innovati', 3],
    ['achieve', 2], ['milestone', 2], ['record', 1], ['first', 1],
    ['pioneer', 3], ['revolutionis', 3], ['transform', 2], ['remarkable', 2],
    ['fascina', 3], ['wonder', 2], ['mystery', 2], ['reveal', 2],
    ['unlock', 2], ['cure', 2], ['solution', 2], ['advance', 2],
    ['progress', 2], ['success', 2], ['triumph', 2], ['inspire', 2],
    ['hope', 2], ['optimis', 2], ['promising', 2], ['excit', 2],
  ]),

  reflection: new Map([
    // Long-form, historical, philosophical — slow burn
    ['history', 2], ['legacy', 3], ['memoir', 3], ['retrospect', 3],
    ['rememb', 2], ['anniversary', 3], ['decade', 2], ['century', 2],
    ['generation', 2], ['philoso', 3], ['ethic', 2], ['moral', 2],
    ['essay', 3], ['meditation', 3], ['contempl', 3], ['ponder', 3],
    ['wisdom', 3], ['lesson', 2], ['teach', 1], ['tradition', 2],
    ['identity', 2], ['meaning', 2], ['value', 1], ['belief', 2],
    ['obituary', 3], ['tribute', 3], ['honor', 2], ['commemo', 3],
  ]),
};
