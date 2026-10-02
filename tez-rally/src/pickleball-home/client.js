import learning from './learning.json' with { type: 'json' };

const mounted = new WeakMap();
const planMinutes = (plan) => Number(plan.totalMinutes ?? plan.minutes ?? plan.durationMinutes) || (plan.blocks || []).reduce((total, block) => total + Number(block.minutes || 0), 0);
const formatTime = (milliseconds) => { const seconds = Math.ceil(Math.max(0, milliseconds) / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };

/** Enhance existing static markup; never requests location, submits data, or injects input as HTML. */
export function mountPickleballHome(root = document) {
  const home = root.matches?.('[data-pickleball-home]') ? root : root.querySelector('[data-pickleball-home]');
  if (!home) return () => {};
  if (mounted.has(home)) return mounted.get(home);
  const doc = home.ownerDocument;
  const win = doc.defaultView;
  const listeners = [];
  const on = (element, event, handler) => { if (!element) return; element.addEventListener(event, handler); listeners.push(() => element.removeEventListener(event, handler)); };
  const all = (selector) => [...home.querySelectorAll(selector)];
  const one = (selector) => home.querySelector(selector);
  home.classList.add('pb-enhanced');

  // Static anchors become a standard keyboard-operated tab set after enhancement.
  const tabs = all('[data-learning-tab]');
  const panels = all('[data-learning-panel]');
  const tablist = one('.pb-learning-tabs');
  tablist?.setAttribute('role', 'tablist');
  const activateTab = (selectedId, focus = false) => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.learningTab === selectedId;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('aria-controls', `pb-path-${tab.dataset.learningTab}`);
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.learningPanel !== selectedId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `pb-tab-${panel.dataset.learningPanel}`);
      panel.tabIndex = 0;
    });
  };
  const initialPath = tabs.find((tab) => win?.location.hash === `#pb-path-${tab.dataset.learningTab}`)?.dataset.learningTab || tabs[0]?.dataset.learningTab;
  if (initialPath) activateTab(initialPath);
  tabs.forEach((tab, index) => {
    on(tab, 'click', (event) => { event.preventDefault(); activateTab(tab.dataset.learningTab); });
    on(tab, 'keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); activateTab(tabs[next].dataset.learningTab, true); }
    });
  });
  on(win, 'hashchange', () => {
    const matched = tabs.find((tab) => win.location.hash === `#pb-path-${tab.dataset.learningTab}`);
    if (matched) activateTab(matched.dataset.learningTab);
  });

  // Checkmarks are optional browser-local state; a denied storage API never blocks practice.
  const progressKey = 'rally:pickleball-practice:v1';
  const checks = all('[data-lesson-complete]');
  const progressNote = one('[data-progress-note]');
  let completed = new Set();
  let storageWorks = true;
  try {
    const stored = JSON.parse(win?.localStorage.getItem(progressKey) || '[]');
    if (Array.isArray(stored)) completed = new Set(stored.filter((value) => typeof value === 'string'));
  } catch { storageWorks = false; }
  const updateProgressNote = () => {
    if (!progressNote) return;
    const count = checks.filter((check) => check.checked).length;
    progressNote.textContent = `${count} of ${checks.length} lessons practiced. ${storageWorks ? 'Checkmarks stay in this browser.' : 'Checkmarks work for this visit; browser storage is unavailable.'}`;
  };
  checks.forEach((check) => {
    check.checked = completed.has(check.dataset.lessonComplete);
    on(check, 'change', () => {
      if (check.checked) completed.add(check.dataset.lessonComplete); else completed.delete(check.dataset.lessonComplete);
      try { win?.localStorage.setItem(progressKey, JSON.stringify([...completed])); } catch { storageWorks = false; }
      updateProgressNote();
    });
  });
  updateProgressNote();

  // Manual court filtering operates only on verified, pre-rendered cards.
  const form = one('[data-court-filters]');
  const search = one('[data-court-search]');
  const region = one('[data-court-region]');
  const ownership = one('[data-court-ownership]');
  const cards = all('[data-court-card]');
  const cityNames = new Set(cards.map((card) => card.dataset.city.toLocaleLowerCase()));
  const count = one('[data-court-count]');
  const empty = one('[data-court-empty]');
  const filterCourts = () => {
    const query = (search?.value || '').trim().toLocaleLowerCase();
    const exactCity = cityNames.has(query);
    const selectedRegion = region?.value || 'all';
    const selectedOwnership = ownership?.value || 'all';
    let visible = 0;
    cards.forEach((card) => {
      const owner = card.dataset.ownership;
      const matchesOwnership = selectedOwnership === 'all' || (selectedOwnership === 'private' ? owner === 'private' || owner === 'commercial' : owner === selectedOwnership);
      const matchesQuery = !query || (exactCity ? card.dataset.city.toLocaleLowerCase() === query : card.dataset.search.includes(query));
      const matches = matchesQuery && (selectedRegion === 'all' || card.dataset.region === selectedRegion) && matchesOwnership;
      card.hidden = !matches;
      if (matches) visible++;
    });
    if (count) count.textContent = `${visible} of ${cards.length} sourced court references`;
    if (empty) empty.hidden = visible > 0;
  };
  on(form, 'submit', (event) => event.preventDefault());
  on(search, 'input', filterCourts);
  on(region, 'change', filterCourts);
  on(ownership, 'change', filterCourts);
  on(form, 'reset', () => {
    // Native reset completes after its event. Set values now so the status is immediate.
    if (search) search.value = '';
    if (region) region.value = 'all';
    if (ownership) ownership.value = 'all';
    filterCourts();
  });
  all('[data-court-city]').forEach((button) => on(button, 'click', () => {
    if (search) search.value = button.dataset.courtCity;
    if (region) region.value = 'all';
    if (ownership) ownership.value = 'all';
    filterCourts();
    search?.focus({ preventScroll: true });
    form?.scrollIntoView?.({ behavior: win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }));

  // The clock is local and optional. A deadline keeps it accurate after a background tab.
  const planSelect = one('[data-plan-select]');
  const practicePanels = all('[data-practice-panel]');
  const timer = one('[data-timer-controls]');
  const timerOutput = one('[data-timer-output]');
  const timerStart = one('[data-timer-start]');
  const timerReset = one('[data-timer-reset]');
  const timerStatus = one('[data-timer-status]');
  let selectedMinutes = Number(planSelect?.value) || 30;
  let totalMilliseconds = selectedMinutes * 60_000;
  let remainingMilliseconds = totalMilliseconds;
  let deadline = 0;
  let interval;
  let running = false;
  let lastBlock = -1;
  const stopInterval = () => { if (interval !== undefined) { win?.clearInterval(interval); interval = undefined; } };
  const currentPlan = () => (learning.practicePlans || []).find((plan) => planMinutes(plan) === selectedMinutes);
  const paintClock = () => {
    if (timerOutput) timerOutput.textContent = formatTime(remainingMilliseconds);
    const elapsed = totalMilliseconds - remainingMilliseconds;
    let boundary = 0;
    const blocks = currentPlan()?.blocks || [];
    const blockIndex = blocks.findIndex((block) => { boundary += Number(block.minutes) * 60_000; return elapsed < boundary; });
    practicePanels.forEach((panel) => panel.querySelectorAll('[data-plan-block]').forEach((block, index) => block.classList.toggle('is-current', Number(panel.dataset.practicePanel) === selectedMinutes && (running || remainingMilliseconds < totalMilliseconds) && index === blockIndex)));
    if (running && blockIndex !== lastBlock && blockIndex >= 0 && timerStatus) timerStatus.textContent = `Now: ${blocks[blockIndex].title}. ${blocks[blockIndex].minutes} minutes.`;
    lastBlock = blockIndex;
  };
  const resetClock = (message = 'Choose a plan. Make it yours.') => {
    stopInterval(); running = false; deadline = 0; lastBlock = -1;
    totalMilliseconds = selectedMinutes * 60_000;
    remainingMilliseconds = totalMilliseconds;
    if (timerStart) { timerStart.textContent = 'Start clock'; timerStart.setAttribute('aria-pressed', 'false'); }
    if (timerStatus) timerStatus.textContent = message;
    paintClock();
  };
  const selectPlan = () => {
    selectedMinutes = Number(planSelect?.value) || 30;
    practicePanels.forEach((panel) => { panel.hidden = Number(panel.dataset.practicePanel) !== selectedMinutes; });
    resetClock(`${selectedMinutes}-minute plan ready. Start when you are.`);
  };
  const tick = () => {
    remainingMilliseconds = Math.max(0, deadline - Date.now());
    paintClock();
    if (remainingMilliseconds === 0) {
      stopInterval(); running = false;
      if (timerStart) { timerStart.textContent = 'Run again'; timerStart.setAttribute('aria-pressed', 'false'); }
      if (timerStatus) timerStatus.textContent = 'Practice complete. Take a breath and carry one good cue into your next game.';
    }
  };
  on(planSelect, 'change', selectPlan);
  on(timerStart, 'click', () => {
    if (running) {
      remainingMilliseconds = Math.max(0, deadline - Date.now());
      stopInterval(); running = false;
      timerStart.textContent = 'Resume clock'; timerStart.setAttribute('aria-pressed', 'false');
      if (timerStatus) timerStatus.textContent = 'Paused. Take the time you need.';
      paintClock();
    } else {
      if (remainingMilliseconds <= 0) resetClock();
      running = true; lastBlock = -1; deadline = Date.now() + remainingMilliseconds;
      timerStart.textContent = 'Pause clock'; timerStart.setAttribute('aria-pressed', 'true');
      tick(); interval = win?.setInterval(tick, 1000);
    }
  });
  on(timerReset, 'click', () => resetClock('Clock reset. Start when you are.'));
  on(win, 'pagehide', stopInterval);
  on(win, 'pageshow', () => {
    // A restored page keeps its deadline. Refresh the clock before restarting its interval.
    if (!running) return;
    stopInterval();
    tick();
    if (running) interval = win?.setInterval(tick, 1000);
  });
  if (timer) timer.hidden = false;
  selectPlan();

  const unmount = () => { stopInterval(); listeners.forEach((remove) => remove()); mounted.delete(home); };
  mounted.set(home, unmount);
  return unmount;
}
