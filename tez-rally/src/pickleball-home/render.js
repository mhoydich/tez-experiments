import learning from './learning.json' with { type: 'json' };
import courtData from './courts.json' with { type: 'json' };

export const pickleballLearning = learning;
export const pickleballCourtData = courtData;

const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const id = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
const href = (value = '#') => /^(https?:\/\/|\/|#)/i.test(String(value)) ? escape(value) : '#';
const arrow = '<span aria-hidden="true">↗</span>';
const link = (url, label, className = '') => `<a class="${escape(className)}" href="${href(url)}">${escape(label)} ${arrow}</a>`;
const kicker = (text) => `<p class="pb-kicker">${escape(text)}</p>`;
const sourceLinks = (sourceIds = []) => sourceIds.map((sourceId) => learning.sources?.find((source) => source.id === sourceId)).filter(Boolean).map((source) => link(source.url, source.title, 'pb-source')).join('');

function renderLesson(lesson, index, pathId) {
  return `<article class="pb-lesson">
    <div class="pb-card-top"><span class="pb-number">${String(index + 1).padStart(2, '0')}</span><label class="pb-progress"><input type="checkbox" data-lesson-complete="${id(pathId)}-${id(lesson.id)}" aria-label="Mark ${escape(lesson.title)} as practiced" /><span>Practiced</span></label></div>
    <h4>${escape(lesson.title)}</h4><p class="pb-lesson-cue">${escape(lesson.cue)}</p>
    <div class="pb-lesson-detail"><p><b>Try it</b> ${escape(lesson.exercise)}</p><p><b>Your checkpoint</b> ${escape(lesson.check)}</p></div>
    ${lesson.sourceIds?.length ? `<div class="pb-sources">${sourceLinks(lesson.sourceIds)}</div>` : ''}
  </article>`;
}

function renderPath(path) {
  return `<section id="pb-path-${id(path.id)}" class="pb-path" data-learning-panel="${id(path.id)}" aria-labelledby="pb-path-title-${id(path.id)}">
    <div class="pb-path-intro"><div><h3 id="pb-path-title-${id(path.id)}">${escape(path.title)}</h3><p>${escape(path.description)}</p></div><p class="pb-path-check"><b>Start here if</b> ${escape(path.selfAssessment)}</p></div>
    <div class="pb-lessons">${(path.lessons || []).map((lesson, index) => renderLesson(lesson, index, path.id)).join('')}</div>
  </section>`;
}

function renderDrill(drill, index) {
  return `<details class="pb-drill"><summary><span class="pb-number">${String(index + 1).padStart(2, '0')}</span><span class="pb-drill-title">${escape(drill.title)}<small>${escape(drill.level)} · ${escape(drill.durationMinutes)} min · ${escape(drill.players)}</small></span><span class="pb-plus" aria-hidden="true">+</span></summary>
    <div class="pb-drill-body"><p><b>Set up</b> ${escape(drill.setup)}</p><ol>${(drill.steps || []).map((step) => `<li>${escape(step)}</li>`).join('')}</ol><p><b>Build it</b> ${escape(drill.progression)}</p><p><b>Success target</b> ${escape(drill.successTarget)}</p>${drill.sourceIds?.length ? `<div class="pb-sources">${sourceLinks(drill.sourceIds)}</div>` : ''}${drill.relatedLinks?.length ? `<div class="pb-sources pb-related-links"><span>Original editorial archive:</span>${drill.relatedLinks.map((resource) => link(resource.url, resource.label, 'pb-source')).join('')}</div>` : ''}</div>
  </details>`;
}

function planMinutes(plan) { return Number(plan.totalMinutes ?? plan.minutes ?? plan.durationMinutes) || (plan.blocks || []).reduce((total, block) => total + Number(block.minutes || 0), 0); }

function renderPlan(plan) {
  const minutes = planMinutes(plan);
  return `<article class="pb-practice-plan" data-practice-panel="${minutes}" id="pb-plan-${minutes}"><div class="pb-plan-heading"><h3>${escape(plan.title || `${minutes}-minute practice`)}</h3><p>${escape(plan.description || plan.focus || 'A little structure. A better next game.')}</p></div><ol class="pb-plan-blocks">${(plan.blocks || []).map((block, index) => `<li data-plan-block="${index}"><span class="pb-block-time">${escape(block.minutes)}<small>min</small></span><div><h4>${escape(block.title)}</h4><p>${escape(block.instruction)}</p>${block.drillId ? `<a href="#pb-drill-lab">Open the drill lab ${arrow}</a>` : ''}</div></li>`).join('')}</ol></article>`;
}

function renderCourt(court, index) {
  const sources = (court.sources || []).map((source) => link(source.url, source.label, 'pb-source')).join('');
  return `<article class="pb-court" id="pb-court-${id(court.id)}" data-court-card data-region="${escape(court.region)}" data-ownership="${escape(court.ownership)}" data-city="${escape(court.city)}" data-search="${escape([court.name, court.city, court.region, court.address, court.environment, court.access].join(' ').toLowerCase())}">
    <div class="pb-court-top"><span class="pb-number">${String(index + 1).padStart(2, '0')}</span><span class="pb-tag">${escape(court.city)}</span><span class="pb-tag pb-ownership">${escape(court.ownership === 'commercial' ? 'Commercial · paid' : court.ownership === 'private' ? 'Private · members' : 'Public')}</span>${court.status === 'confirm' ? '<span class="pb-tag pb-tag-alert">Confirm details</span>' : ''}</div>
    <h3>${escape(court.name)}</h3><p class="pb-court-description">${escape(court.courtDescription || court.environment)}</p><p class="pb-address">${escape(court.address)}</p>
    <dl class="pb-court-facts"><div><dt>Access</dt><dd>${escape(court.access)}</dd></div>${court.scheduleNote ? `<div><dt>Before you go</dt><dd>${escape(court.scheduleNote)}</dd></div>` : ''}</dl>
    ${(court.rules?.length || court.limits?.length) ? `<details class="pb-court-details"><summary>Local rules & access notes <span aria-hidden="true">+</span></summary><ul>${[...(court.rules || []), ...(court.limits || [])].map((rule) => `<li>${escape(rule)}</li>`).join('')}</ul></details>` : ''}
    <div class="pb-court-bottom">${link(court.mapUrl, 'Directions', 'pb-text-link')}<span>Checked ${escape(court.checkedDate || courtData.checkedDate)}</span></div><div class="pb-sources">${sources}</div>
  </article>`;
}

function locator(courts) {
  const cities = [
    { name: 'Santa Monica', x: 36, y: 14 },
    { name: 'El Segundo', x: 46, y: 38 },
    { name: 'Manhattan Beach', x: 44, y: 57 },
    { name: 'Hawthorne', x: 73, y: 48 },
    { name: 'Hermosa Beach', x: 45, y: 69 },
    { name: 'Torrance', x: 65, y: 84 },
  ].filter((city) => courts.some((court) => court.city === city.name));
  return `<div class="pb-locator"><svg viewBox="0 0 520 600" role="img" aria-labelledby="pb-map-title pb-map-desc"><title id="pb-map-title">Los Angeles and South Bay city locator</title><desc id="pb-map-desc">Schematic coastal locator. City positions show the region; use each venue's directions link for the court location.</desc><defs><pattern id="pb-map-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="currentColor" stroke-width="0.7"/></pattern></defs><rect width="520" height="600" fill="#0955cf"/><path d="M130 -10 L167 60 Q169 135 201 176 L218 225 Q239 249 218 294 L199 352 Q205 382 244 413 L261 455 Q285 498 319 518 L390 610 L530 610 L530 -10Z" fill="#064735"/><rect width="520" height="600" fill="url(#pb-map-grid)" opacity=".14"/><path d="M267 8 L290 163 L306 295 L318 410 L384 590" fill="none" stroke="#d4f34a" stroke-width="2" stroke-dasharray="8 10" opacity=".4"/><text x="33" y="366" fill="#fff" font-size="14" transform="rotate(-65 33 366)" letter-spacing="5">PACIFIC OCEAN</text><text x="385" y="160" fill="#d4f34a" font-size="11" letter-spacing="2">LOS</text><text x="385" y="177" fill="#d4f34a" font-size="11" letter-spacing="2">ANGELES</text></svg>
    <div class="pb-map-cities">${cities.map((city) => `<button type="button" class="pb-city-pin" style="--pin-x:${city.x}%;--pin-y:${city.y}%" data-court-city="${escape(city.name)}"><span class="pb-pin-dot" aria-hidden="true"></span><span>${escape(city.name)}</span></button>`).join('')}</div><div class="pb-map-caption"><b>Pick your city.</b><span>City-level locator · exact directions on each card</span></div>
  </div>`;
}

/** Shared static, escaped home markup. Interactions are an optional progressive enhancement. */
export function renderPickleballHome({ brand = 'rally', assetBase = '/images/pickleball-home', rallyUrl = 'https://tez-rally.pages.dev', pointcastUrl = 'https://pointcast.xyz' } = {}) {
  const isPointcast = brand === 'pointcast';
  const mainTag = isPointcast ? 'div' : 'main';
  const ownRally = (route = '/') => isPointcast ? `${rallyUrl}${route}` : route;
  const ownPointcast = (route = '/') => isPointcast ? route : `${pointcastUrl}${route}`;
  const courts = courtData.courts || [];
  const paths = learning.paths || [];
  const plans = learning.practicePlans || [];
  const regions = [...new Set(courts.map((court) => court.region))];

  const rallyTools = [
    ['/tonight/', 'Run open play', 'Turn a crew into fair doubles rounds, score the session, and keep a recap.', '01'],
    ['/score/', 'Call the score', 'A courtside score caller for standard side-out doubles scoring.', '02'],
    ['/bag/', 'Keep your bag', 'Log your paddles, court hours, and wear. Compare what you actually play.', '03'],
    ['/desk/', 'The RALLY desk', 'Find your level, make a player portrait, and explore the existing rating desk.', '04'],
    ['/paddle-calendar/', 'Paddle calendar', 'Follow sourced release history and research notes, with dates and confidence.', '05'],
    ['/guide/', 'The field guide', 'Keep exploring rules, equipment, ratings, lessons, and South Bay play.', '06'],
    ['/pros/', 'Follow the pro game', 'The existing tour, team, format, and ranking reference.', '07'],
    ['/paddle-fund/', 'Paddle fund concept', 'A playable pretend-money rotation for a crew. Explore the existing demo.', '08'],
  ];
  const pointcastTools = [
    ['/paddles', 'The paddle register', 'Browse the equipment research, source notes, and individual paddle files.'],
    ['/paddles/compare', 'Compare paddles', 'Put build, shape, and published measurements side by side.'],
    ['/paddles/oracle', 'The paddle oracle', 'A free match-count preview; paid sourced answers are labeled on the destination.'],
    ['/paddles/legal', 'Rules & legal tracker', 'Read the existing equipment standards and legal research archive.'],
    ['/reviews/paddles', 'Paddle Takes', 'The firsthand-review method and empty review archive. No reviews are published yet.'],
    ['/paddles/pros', 'Pros & their paddles', 'A sourced model and signing reference, with its own checked dates.'],
    ['/paddles/changes', 'Register changes', 'Source-linked additions, corrections, and equipment history.'],
    ['/paddle-exchange', 'Paddle exchange', 'A browser-only trade, loan, and try profile concept; no shared stock is implied.'],
    ['/reviews/bags', 'The court bag desk', 'Sourced bag specifications and comparisons, with no hands-on claim.'],
    ['/beach-commons/v19#pocket-seats', 'A seat between games', 'The existing researched compact-seat reference for court breaks.'],
    ['/court', 'The court shortcut', 'The existing short link to the Field Reports court spot.'],
    ['/r/courts', 'Field Reports', 'Explore the local reporting experience and its existing court context.'],
    ['/pickleball', 'The pickleball board', 'The original PointCast board stays in place: sessions, context, and links.'],
    ['/games/noun-pickleball/', 'Noun Court Doubles', 'Play the existing CPU or pass-and-play game, with practice drills.'],
    ['/brick-choir/third-shot', 'Third Shot', 'Phone-native strategic doubles with coach callouts, drills, and a Shot Report.'],
    ['/brick-choir/park', 'Pickle Park', 'The existing TV court game with phone paddles and customized Buddies.'],
    ['/brick-choir/rally', 'Rally, the game', 'PointCast’s distinct musical TV-and-phone game for one to four players.'],
    ['/brick-choir/watch', 'Watch a room', 'Join the existing spectator experience with a four-letter room code.'],
  ];

  return `<div class="pb-home pb-brand-${isPointcast ? 'pointcast' : 'rally'}" data-pickleball-home>
    ${isPointcast ? '' : '<a class="pb-skip" href="#pb-main">Skip to pickleball home</a>'}
    <header class="pb-header"><a class="pb-wordmark" href="${href(isPointcast ? '/pickleball/home' : '/')}" aria-label="${isPointcast ? 'PointCast pickleball home' : 'RALLY home'}">${isPointcast ? '<span class="pb-pointcast-word">PointCast</span><span class="pb-brand-sub">PICKLEBALL</span>' : 'RALLY<span class="pb-logo-ball" aria-hidden="true"><i></i><i></i><i></i></span>'}</a><nav class="pb-nav" aria-label="Pickleball navigation"><a href="#pb-learn">Learn</a><a href="#pb-courts">Courts</a><a href="#pb-practice">Practice</a><a href="#pb-tools">The kit</a><a class="pb-board-link" href="${href(ownPointcast('/pickleball'))}">Court board</a><a class="pb-sister-link" href="${href(isPointcast ? rallyUrl : `${pointcastUrl}/pickleball/home`)}">${isPointcast ? 'RALLY' : 'PointCast'} ${arrow}</a></nav></header>
    <${mainTag} id="pb-main">
      <section class="pb-hero" aria-labelledby="pb-hero-title"><div class="pb-hero-copy">${kicker(isPointcast ? 'PointCast × RALLY / The pickleball connection' : 'Southern California / Pickleball, all in')}<h1 id="pb-hero-title">Leave it all<br>on the <em>court.</em></h1><p class="pb-hero-deck">Your next game starts here. Find a court, build a better rally, and bring your people.</p><div class="pb-hero-actions"><a href="#pb-courts" class="pb-button pb-button-lime">Find a court <span aria-hidden="true">↘</span></a><a href="#pb-learn" class="pb-button pb-button-outline">Build your game <span aria-hidden="true">↘</span></a></div><div class="pb-hero-foot"><span>EL SEGUNDO · SOUTH BAY · BEYOND</span><span>SHOW UP. PLAY MORE.</span></div></div><figure class="pb-hero-art"><img src="${href(`${assetBase}/leave-it-all.webp`)}" alt="Leave it all on the court: RALLY pickleball campaign artwork" width="1122" height="1402" fetchpriority="high" /><figcaption><span>THE COURT IS THE COMMON GROUND.</span><span>RALLY / CAMPAIGN STUDY</span></figcaption></figure></section>
      <div class="pb-marquee" aria-label="Play, learn, rally, repeat"><span>PLAY</span><span aria-hidden="true">✳</span><span>LEARN</span><span aria-hidden="true">✳</span><span>RALLY</span><span aria-hidden="true">✳</span><span>REPEAT</span><span aria-hidden="true">✳</span><span>PLAY</span></div>

      <span class="pb-anchor" id="learn"></span><section class="pb-section pb-learn" id="pb-learn" aria-labelledby="pb-learn-title"><div class="pb-section-heading"><div>${kicker('01 / Build your game')}<h2 id="pb-learn-title">A little better.<br><em>Every time.</em></h2></div><p>You don’t need a perfect game to belong on court. Pick a starting point, practice with purpose, and move forward when the checkpoint feels repeatable.</p></div><nav class="pb-learning-tabs" aria-label="Learning paths">${paths.map((path) => `<a href="#pb-path-${id(path.id)}" id="pb-tab-${id(path.id)}" data-learning-tab="${id(path.id)}">${escape(path.id)} <span aria-hidden="true">↗</span></a>`).join('')}</nav><div class="pb-paths">${paths.map(renderPath).join('')}</div><p class="pb-storage-note" data-progress-note>Practice checkmarks stay in this browser when storage is available.</p><div class="pb-rules-strip"><h3>Before the first serve.</h3><div class="pb-rule-basics">${(learning.ruleBasics || []).map((rule) => `<div><h4>${escape(rule.title)}</h4><p>${escape(rule.text)}</p></div>`).join('')}</div><div class="pb-rules-links">${(courtData.rulesResources || []).map((resource) => link(resource.url, resource.name, 'pb-text-link')).join('')}</div><p class="pb-fine-print">${escape(learning.editorialNote || 'Instruction is original practice guidance. Refer to the current official rulebook and your venue’s posted rules.')} Rules checked ${escape(learning.checkedAt || courtData.checkedDate)}.</p></div><details class="pb-learning-archive"><summary>Keep the original links close. <span aria-hidden="true">+</span></summary><p>The existing guide and score tool, plus PointCast’s original editorial notes. The practice prompts above are newly written; archive notes retain their original context.</p><div>${(learning.preservedResources || []).map((resource) => `<article>${link(resource.url.startsWith(rallyUrl) ? ownRally(resource.url.slice(rallyUrl.length)) : resource.url.startsWith(pointcastUrl) ? ownPointcast(resource.url.slice(pointcastUrl.length)) : resource.url, resource.title, 'pb-text-link')}<p>${escape(resource.description)}</p></article>`).join('')}</div></details></section>

      <span class="pb-anchor" id="play"></span><section class="pb-section pb-practice" id="pb-practice" aria-labelledby="pb-practice-title"><div class="pb-section-heading"><div>${kicker('02 / Make the next half hour count')}<h2 id="pb-practice-title">Less scrolling.<br><em>More reps.</em></h2></div><p>A warm-up, one clear focus, and a little play. Choose the time you have. Every plan is ready to take to the court.</p></div><div class="pb-practice-layout"><aside class="pb-practice-controls"><label for="pb-plan-duration">How much time?</label><select id="pb-plan-duration" data-plan-select>${plans.map((plan) => `<option value="${planMinutes(plan)}"${planMinutes(plan) === 30 ? ' selected' : ''}>${planMinutes(plan)} minutes</option>`).join('')}</select><div class="pb-timer" data-timer-controls hidden><span class="pb-kicker">PRACTICE CLOCK</span><output data-timer-output role="timer" aria-live="off" aria-label="Time remaining">30:00</output><div class="pb-timer-buttons"><button class="pb-button pb-button-lime" type="button" data-timer-start>Start clock</button><button class="pb-timer-reset" type="button" data-timer-reset>Reset</button></div><p data-timer-status role="status">Choose a plan. Make it yours.</p></div><div class="pb-plan-tip"><span aria-hidden="true">✳</span><p>Start easy. Keep the ball in play. Stop the drill when quality slips, reset, and try again.</p></div></aside><div class="pb-plans">${plans.map(renderPlan).join('')}</div></div><div class="pb-drill-lab" id="pb-drill-lab"><div class="pb-drill-lab-heading"><h3>The drill lab.</h3><p>Simple setups. Clear targets. Open a drill and get going.</p></div><div class="pb-drills">${(learning.drills || []).map(renderDrill).join('')}</div></div></section>

      <span class="pb-anchor" id="courts"></span><section class="pb-section pb-courts-section" id="pb-courts" aria-labelledby="pb-courts-title"><div class="pb-section-heading"><div>${kicker('03 / Find your place')}<h2 id="pb-courts-title">Meet you<br><em>at the court.</em></h2></div><p>Start in El Segundo and the South Bay, then head up the coast. These are sourced venue references: check the current city schedule and access requirements before you go.</p></div><div class="pb-court-layout"><aside class="pb-court-map">${locator(courts)}<div class="pb-discovery-note"><h3>Keep exploring.</h3><p>A bigger search starts with a reliable source.</p>${(courtData.discovery || []).map((route) => `<div>${link(route.url, route.name, 'pb-text-link')}<p>${escape(route.description)}</p></div>`).join('')}</div></aside><div class="pb-court-list"><form class="pb-court-filters" data-court-filters role="search" aria-label="Filter court references"><label class="pb-search-label" for="pb-court-search">City or court<input id="pb-court-search" type="search" placeholder="Try El Segundo" data-court-search autocomplete="off" /></label><label for="pb-court-region">Region<select id="pb-court-region" data-court-region><option value="all">All regions</option>${regions.map((region) => `<option value="${escape(region)}">${escape(region)}</option>`).join('')}</select></label><label for="pb-court-ownership">Court type<select id="pb-court-ownership" data-court-ownership><option value="all">Public & private</option><option value="public">Public courts</option><option value="private">Private & commercial</option></select></label><button type="reset" class="pb-filter-reset">Clear</button></form><p class="pb-court-results" role="status" aria-live="polite" data-court-count>${courts.length} sourced court references · checked ${escape(courtData.checkedDate)}</p><p class="pb-court-notice">${escape(courtData.notice || 'A listing is not a live availability feed. Hours, fees, and access may change.')}</p><div class="pb-court-cards">${courts.map(renderCourt).join('')}</div><p class="pb-empty" data-court-empty hidden>No courts match those filters. Clear a filter or try a nearby city.</p></div></div></section>

      <span class="pb-anchor" id="culture"></span><section class="pb-campaign" aria-labelledby="pb-campaign-title"><div class="pb-campaign-intro">${kicker('04 / A little court culture')}<h2 id="pb-campaign-title">Good game.<br><em>Great company.</em></h2><p>Palms overhead. A ball in the air. One more game before the light goes. RALLY’s visual world is built around the people who make a court feel like home.</p><p class="pb-campaign-label">Independent generated campaign and courtwear concepts. Any depicted locations or teams are fictional; no Nouns endorsement, product availability, or checkout is implied.</p></div><div class="pb-campaign-grid"><figure><img loading="lazy" src="${href(`${assetBase}/courtside.webp`)}" alt="RALLY courtside campaign concept" width="1000" height="1250" /><figcaption><span>01 / COURTSIDE</span><b>Stay for one more.</b></figcaption></figure><figure><img loading="lazy" src="${href(`${assetBase}/essentials.webp`)}" alt="RALLY pickleball essentials campaign concept" width="1000" height="1250" /><figcaption><span>02 / THE ESSENTIALS</span><b>Bring your game.</b></figcaption></figure><figure class="pb-campaign-wide"><img loading="lazy" src="${href(`${assetBase}/banner.webp`)}" alt="RALLY courtside banner campaign concept" width="1536" height="1024" /><figcaption><span>03 / COURTSIDE BANNER</span><b>The common ground.</b></figcaption></figure></div><div class="pb-nouns-heading"><h3>Nouns × RALLY.<br>A crew with character.</h3><p>Explore the complete independent courtwear study: the court kit, club layer, essentials, and campaign. Exact Nouns vector artwork and the original specification are preserved below.</p></div><div class="pb-nouns-grid">${[['nouns-court-kit.webp','The court kit'],['nouns-club-layer.webp','The club layer'],['nouns-essentials.webp','Court essentials'],['nouns-campaign.webp','The campaign']].map(([file,title]) => `<figure><img src="${href(`${assetBase}/${file}`)}" alt="${escape(title)}: independent Nouns × RALLY concept" width="1200" height="800" loading="lazy" /><figcaption>${escape(title)} / CONCEPT</figcaption></figure>`).join('')}</div><div class="pb-nouns-assets">${[0,1,2].map((number) => `<a href="${href(`${assetBase}/Noun-${number}-transparent.svg`)}" aria-label="Open exact Noun ${number} vector artwork"><img src="${href(`${assetBase}/Noun-${number}-transparent.svg`)}" alt="Noun ${number}" width="58" height="58" loading="lazy" /></a>`).join('')}<a href="${href(`${assetBase}/Noggles-one-color.svg`)}" aria-label="Open exact Noggles vector artwork"><img class="pb-noggles" src="${href(`${assetBase}/Noggles-one-color.svg`)}" alt="Noggles" width="80" height="36" loading="lazy" /></a><div>${link(`${assetBase}/nouns-courtwear-spec.pdf`, 'Original courtwear specification', 'pb-text-link')}${link(`${assetBase}/nouns-provenance.json`, 'Artwork provenance', 'pb-text-link')}</div></div></section>

      <span class="pb-anchor" id="gear"></span><section class="pb-section pb-tools-section" id="pb-tools" aria-labelledby="pb-tools-title"><div class="pb-section-heading"><div>${kicker('05 / The kit, already in play')}<h2 id="pb-tools-title">Everything<br><em>comes together.</em></h2></div><p>RALLY brings the crew tools. PointCast brings the research and local context. Keep the useful things close, from your first session to your next paddle.</p></div><div class="pb-gear-advice"><div><h3>Start with feel.</h3><p>Use a comfortable grip and a paddle you can control through a full session. Borrow or demo a few shapes before choosing; the most expensive paddle is not a practice plan.</p></div><div><h3>Compare the evidence.</h3><p>Separate measured results from maker claims. Compare shape, weight, dimensions, construction, and dated source notes in the register.</p></div><div><h3>Check your event.</h3><p>Equipment approval depends on the event’s governing rules. Confirm the exact model on the current official list, then keep an eye on wear and damage.</p></div></div><div class="pb-tool-group"><div class="pb-tool-group-title"><h3>From RALLY.</h3>${link(ownRally(), 'Open RALLY', 'pb-text-link')}</div><div class="pb-tool-grid">${rallyTools.map(([route, title, description, number]) => `<a class="pb-tool-card" href="${href(ownRally(route))}"><span class="pb-number">${number}</span><h4>${escape(title)} ${arrow}</h4><p>${escape(description)}</p></a>`).join('')}</div></div><div class="pb-tool-group pb-pointcast-group"><div class="pb-tool-group-title"><h3>Across at PointCast.</h3>${link(ownPointcast('/pickleball/home'), 'Open the sister home', 'pb-text-link')}</div><div class="pb-pointcast-grid">${pointcastTools.map(([route, title, description]) => `<a class="pb-pointcast-tool" href="${href(ownPointcast(route))}"><h4>${escape(title)} ${arrow}</h4><p>${escape(description)}</p></a>`).join('')}</div></div></section>

      <section class="pb-closing"><span class="pb-closing-ball" aria-hidden="true">✳</span><h2>See you<br>out there.</h2><a class="pb-button pb-button-lime" href="#pb-courts">Find your next court <span aria-hidden="true">↗</span></a><p>PLAY GENEROUSLY. LEAVE THE COURT BETTER.</p></section>
    </${mainTag}><footer class="pb-footer"><a class="pb-footer-word" href="${href(ownRally())}">RALLY</a><p>Pickleball, all in.<br>El Segundo · South Bay · wherever the game takes you.</p><div>${link(isPointcast ? rallyUrl : `${pointcastUrl}/pickleball/home`, isPointcast ? 'Visit RALLY' : 'Visit PointCast', 'pb-text-link')}<a href="#pb-main">Back to the top ↑</a></div><p class="pb-footer-note">RALLY and PointCast are independent experiences. Court references are checked editorial information, not reservations. Existing tool terms apply on their own pages.</p></footer>
    <noscript><p class="pb-noscript">All learning paths, practice plans, and court references are available above. Filtering and the practice clock require JavaScript.</p></noscript>
  </div>`;
}
