/**
 * Country Detector — extracts ISO 3166-1 alpha-2 country codes from article text.
 *
 * Scans title, summary, and source metadata for country/region mentions.
 * Returns the most likely country code, or null if none detected.
 *
 * Pure function. No external calls.
 */

/**
 * Country name/demonym → ISO 3166-1 alpha-2 code.
 * Entries are lowercase. Weighted: 3 = country name, 2 = capital/demonym, 1 = ambiguous.
 */
const COUNTRY_PATTERNS = [
  // Major English-speaking
  { code: 'US', terms: [['united states', 3], ['u.s.', 3], ['us ', 1], ['america', 2], ['american', 2], ['washington dc', 3], ['white house', 3], ['pentagon', 2], ['congress', 2], ['senate', 1], ['california', 3], ['new york', 2], ['texas', 3], ['florida', 3], ['chicago', 2], ['los angeles', 2], ['biden', 2], ['trump', 2], ['republican', 1], ['democrat', 1]] },
  { code: 'GB', terms: [['united kingdom', 3], ['uk ', 2], ['u.k.', 3], ['britain', 3], ['british', 3], ['england', 3], ['english', 1], ['scotland', 3], ['scottish', 3], ['wales', 2], ['welsh', 2], ['london', 2], ['downing street', 3], ['westminster', 3], ['nhs', 2], ['starmer', 2], ['sunak', 2], ['labour', 1], ['tory', 2], ['tories', 2], ['mandelson', 2]] },
  { code: 'CA', terms: [['canada', 3], ['canadian', 3], ['ottawa', 2], ['toronto', 2], ['trudeau', 3], ['quebec', 3], ['ontario', 2], ['alberta', 2], ['vancouver', 2]] },
  { code: 'AU', terms: [['australia', 3], ['australian', 3], ['sydney', 2], ['melbourne', 2], ['canberra', 2], ['queensland', 2]] },
  { code: 'NZ', terms: [['new zealand', 3], ['zealand', 2], ['kiwi', 1], ['auckland', 2], ['wellington', 1]] },
  { code: 'IE', terms: [['ireland', 3], ['irish', 3], ['dublin', 2]] },

  // Europe
  { code: 'FR', terms: [['france', 3], ['french', 3], ['paris', 2], ['macron', 3], ['élysée', 3]] },
  { code: 'DE', terms: [['germany', 3], ['german', 3], ['berlin', 2], ['merkel', 3], ['scholz', 3], ['bundestag', 3], ['bundeswehr', 3]] },
  { code: 'IT', terms: [['italy', 3], ['italian', 3], ['rome', 2], ['meloni', 3]] },
  { code: 'ES', terms: [['spain', 3], ['spanish', 3], ['madrid', 2], ['barcelona', 1], ['sánchez', 3]] },
  { code: 'PT', terms: [['portugal', 3], ['portuguese', 3], ['lisbon', 2]] },
  { code: 'NL', terms: [['netherlands', 3], ['dutch', 3], ['amsterdam', 2], ['rotterdam', 2]] },
  { code: 'BE', terms: [['belgium', 3], ['belgian', 3], ['brussels', 2]] },
  { code: 'SE', terms: [['sweden', 3], ['swedish', 3], ['stockholm', 2]] },
  { code: 'NO', terms: [['norway', 3], ['norwegian', 3], ['oslo', 2]] },
  { code: 'DK', terms: [['denmark', 3], ['danish', 3], ['copenhagen', 2]] },
  { code: 'FI', terms: [['finland', 3], ['finnish', 3], ['helsinki', 2]] },
  { code: 'PL', terms: [['poland', 3], ['polish', 2], ['warsaw', 2]] },
  { code: 'GR', terms: [['greece', 3], ['greek', 3], ['athens', 2]] },
  { code: 'AT', terms: [['austria', 3], ['austrian', 3], ['vienna', 2]] },
  { code: 'CH', terms: [['switzerland', 3], ['swiss', 3], ['zurich', 2], ['geneva', 2]] },
  { code: 'UA', terms: [['ukraine', 3], ['ukrainian', 3], ['kyiv', 3], ['zelensky', 3], ['zelenskyy', 3]] },
  { code: 'RO', terms: [['romania', 3], ['romanian', 3], ['bucharest', 2]] },
  { code: 'HU', terms: [['hungary', 3], ['hungarian', 3], ['budapest', 2], ['orbán', 3], ['orban', 3]] },
  { code: 'CZ', terms: [['czech', 3], ['czechia', 3], ['prague', 2]] },

  // Russia & former Soviet
  { code: 'RU', terms: [['russia', 3], ['russian', 3], ['moscow', 2], ['kremlin', 3], ['putin', 3]] },
  { code: 'BY', terms: [['belarus', 3], ['belarusian', 3], ['minsk', 2], ['lukashenko', 3]] },
  { code: 'GE', terms: [['georgia', 2], ['georgian', 2], ['tbilisi', 3]] },
  { code: 'KZ', terms: [['kazakhstan', 3], ['kazakh', 3]] },

  // Middle East
  { code: 'IL', terms: [['israel', 3], ['israeli', 3], ['tel aviv', 3], ['jerusalem', 2], ['netanyahu', 3], ['idf', 2]] },
  { code: 'PS', terms: [['palestine', 3], ['palestinian', 3], ['gaza', 3], ['west bank', 3], ['hamas', 2]] },
  { code: 'IR', terms: [['iran', 3], ['iranian', 3], ['tehran', 3], ['khamenei', 3]] },
  { code: 'IQ', terms: [['iraq', 3], ['iraqi', 3], ['baghdad', 3]] },
  { code: 'SY', terms: [['syria', 3], ['syrian', 3], ['damascus', 3]] },
  { code: 'SA', terms: [['saudi', 3], ['saudi arabia', 3], ['riyadh', 3]] },
  { code: 'AE', terms: [['emirates', 3], ['uae', 3], ['dubai', 2], ['abu dhabi', 3]] },
  { code: 'TR', terms: [['turkey', 3], ['turkish', 3], ['türkiye', 3], ['ankara', 2], ['istanbul', 2], ['erdogan', 3]] },
  { code: 'LB', terms: [['lebanon', 3], ['lebanese', 3], ['beirut', 3], ['hezbollah', 2]] },
  { code: 'YE', terms: [['yemen', 3], ['yemeni', 3], ['houthi', 3]] },
  { code: 'JO', terms: [['jordan', 2], ['jordanian', 3], ['amman', 2]] },
  { code: 'AF', terms: [['afghanistan', 3], ['afghan', 3], ['kabul', 3], ['taliban', 2]] },

  // Asia
  { code: 'CN', terms: [['china', 3], ['chinese', 3], ['beijing', 3], ['shanghai', 2], ['xi jinping', 3]] },
  { code: 'JP', terms: [['japan', 3], ['japanese', 3], ['tokyo', 2]] },
  { code: 'KR', terms: [['south korea', 3], ['korean', 2], ['seoul', 2]] },
  { code: 'KP', terms: [['north korea', 3], ['pyongyang', 3], ['kim jong', 3]] },
  { code: 'IN', terms: [['india', 3], ['indian', 3], ['modi', 2], ['delhi', 2], ['mumbai', 2]] },
  { code: 'PK', terms: [['pakistan', 3], ['pakistani', 3], ['islamabad', 3]] },
  { code: 'BD', terms: [['bangladesh', 3], ['bangladeshi', 3], ['dhaka', 3]] },
  { code: 'MM', terms: [['myanmar', 3], ['burmese', 3], ['burma', 3]] },
  { code: 'TH', terms: [['thailand', 3], ['thai', 3], ['bangkok', 2]] },
  { code: 'VN', terms: [['vietnam', 3], ['vietnamese', 3], ['hanoi', 3]] },
  { code: 'PH', terms: [['philippines', 3], ['filipino', 3], ['manila', 2]] },
  { code: 'ID', terms: [['indonesia', 3], ['indonesian', 3], ['jakarta', 3]] },
  { code: 'MY', terms: [['malaysia', 3], ['malaysian', 3], ['kuala lumpur', 3]] },
  { code: 'SG', terms: [['singapore', 3], ['singaporean', 3]] },
  { code: 'TW', terms: [['taiwan', 3], ['taiwanese', 3], ['taipei', 3]] },
  { code: 'LK', terms: [['sri lanka', 3], ['sri lankan', 3], ['colombo', 2]] },
  { code: 'NP', terms: [['nepal', 3], ['nepalese', 3], ['kathmandu', 3]] },

  // Africa
  { code: 'ZA', terms: [['south africa', 3], ['south african', 3], ['johannesburg', 2], ['cape town', 2], ['pretoria', 2]] },
  { code: 'NG', terms: [['nigeria', 3], ['nigerian', 3], ['lagos', 2], ['abuja', 2]] },
  { code: 'KE', terms: [['kenya', 3], ['kenyan', 3], ['nairobi', 2]] },
  { code: 'EG', terms: [['egypt', 3], ['egyptian', 3], ['cairo', 2]] },
  { code: 'ET', terms: [['ethiopia', 3], ['ethiopian', 3], ['addis ababa', 3]] },
  { code: 'SD', terms: [['sudan', 3], ['sudanese', 3], ['khartoum', 3]] },
  { code: 'CD', terms: [['congo', 2], ['congolese', 3], ['kinshasa', 3]] },
  { code: 'GH', terms: [['ghana', 3], ['ghanaian', 3], ['accra', 2]] },
  { code: 'TZ', terms: [['tanzania', 3], ['tanzanian', 3]] },
  { code: 'MA', terms: [['morocco', 3], ['moroccan', 3], ['rabat', 2]] },
  { code: 'DZ', terms: [['algeria', 3], ['algerian', 3]] },
  { code: 'TN', terms: [['tunisia', 3], ['tunisian', 3]] },
  { code: 'LY', terms: [['libya', 3], ['libyan', 3], ['tripoli', 2]] },
  { code: 'SO', terms: [['somalia', 3], ['somali', 3], ['mogadishu', 3]] },
  { code: 'RW', terms: [['rwanda', 3], ['rwandan', 3], ['kigali', 2]] },

  // Americas
  { code: 'MX', terms: [['mexico', 3], ['mexican', 3], ['mexico city', 3], ['cartel', 1]] },
  { code: 'BR', terms: [['brazil', 3], ['brazilian', 3], ['brasília', 3], ['são paulo', 2], ['lula', 3]] },
  { code: 'AR', terms: [['argentina', 3], ['argentine', 3], ['buenos aires', 3], ['milei', 3]] },
  { code: 'CO', terms: [['colombia', 3], ['colombian', 3], ['bogotá', 3]] },
  { code: 'VE', terms: [['venezuela', 3], ['venezuelan', 3], ['caracas', 3], ['maduro', 3]] },
  { code: 'CL', terms: [['chile', 3], ['chilean', 3], ['santiago', 2]] },
  { code: 'PE', terms: [['peru', 3], ['peruvian', 3], ['lima', 2]] },
  { code: 'CU', terms: [['cuba', 3], ['cuban', 3], ['havana', 3]] },
  { code: 'HT', terms: [['haiti', 3], ['haitian', 3]] },

  // Oceania
  { code: 'FJ', terms: [['fiji', 3], ['fijian', 3]] },
  { code: 'PG', terms: [['papua new guinea', 3]] },
];

/**
 * Detect the most likely country code from article text.
 *
 * @param {object} article — must have title, summary (optional), sourceId (optional)
 * @returns {string|null} ISO 3166-1 alpha-2 code, or null
 */
export function detectCountry(article) {
  const titleText = (article.title || '').toLowerCase();
  const bodyText = (article.summary || '').toLowerCase();
  const fullText = `${titleText} ${bodyText}`;

  const scores = {};

  for (const { code, terms } of COUNTRY_PATTERNS) {
    let score = 0;
    for (const [term, weight] of terms) {
      // Title mentions are 2x weight
      if (titleText.includes(term)) {
        score += weight * 2;
      } else if (fullText.includes(term)) {
        score += weight;
      }
    }
    if (score > 0) {
      scores[code] = score;
    }
  }

  // Pick highest scoring country, minimum threshold of 2 to avoid noise
  let bestCode = null;
  let bestScore = 2;

  for (const [code, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestCode = code;
      bestScore = score;
    }
  }

  return bestCode;
}
