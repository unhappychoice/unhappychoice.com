(() => {
  const FEATURED_URL = '../data/featured.json';
  const REPOS_URL = '../data/repos.json';
  const ACTIVITY_BASE = '../data/activity/';
  const root = document.getElementById('featured-root');
  if (!root) return;

  const render = (entries) => {
    if (entries.length === 0) {
      root.innerHTML = '<p class="featured-empty">No featured projects yet.</p>';
      return;
    }
    root.innerHTML = entries.map(cardHtml).join('');
    entries.forEach((entry) => loadActivity(entry.repo));
  };

  const cardHtml = (entry) => {
    const r = entry.meta;
    const ogUrl = `https://opengraph.githubassets.com/1/${entry.repo}`;
    return `
      <article class="featured-card">
        <a class="featured-card__hero" href="${escape(r.html_url)}" target="_blank" rel="noopener">
          <img src="${escape(ogUrl)}" alt="${escape(entry.repo)} social preview" loading="lazy" />
        </a>
        <div class="featured-card__body">
          <div class="featured-card__head">
            <h3 class="featured-card__title">
              <a href="${escape(r.html_url)}" target="_blank" rel="noopener">${escape(entry.repo)}</a>
            </h3>
            <div class="featured-card__badges">
              ${r.language ? `<span class="repo-card__lang">${escape(r.language)}</span>` : ''}
              <span class="featured-card__stars" title="Stars">★ ${formatNumber(r.stargazers_count)}</span>
            </div>
          </div>
          ${entry.tagline ? `<p class="featured-card__tagline">${escape(entry.tagline)}</p>` : ''}
          <div class="featured-card__story">${renderMarkdown(entry.story || '')}</div>
          ${renderLinks(entry, r)}
          <div class="featured-card__activity" data-repo="${escape(entry.repo)}">
            <h4>Recent activity</h4>
            <p class="featured-card__activity-empty">Loading…</p>
          </div>
        </div>
      </article>
    `;
  };

  const renderLinks = (entry, repo) => {
    const links = [
      { label: 'GitHub', url: repo.html_url },
      ...(repo.homepage ? [{ label: 'Site', url: repo.homepage }] : []),
      ...(entry.links || []),
    ];
    return `<div class="featured-card__links">${links
      .map((l) => `<a href="${escape(l.url)}" target="_blank" rel="noopener">${escape(l.label)} →</a>`)
      .join('')}</div>`;
  };

  const loadActivity = (repo) => {
    const slot = root.querySelector(`.featured-card__activity[data-repo="${cssEscape(repo)}"]`);
    if (!slot) return;
    const url = `${ACTIVITY_BASE}${repo.replace('/', '__')}.json`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((events) => {
        const items = events.slice(0, 5).map(activityHtml).filter(Boolean);
        if (items.length === 0) {
          slot.innerHTML = '<h4>Recent activity</h4><p class="featured-card__activity-empty">Quiet here.</p>';
          return;
        }
        slot.innerHTML = `<h4>Recent activity</h4><ul>${items.join('')}</ul>`;
      })
      .catch(() => {
        slot.innerHTML = '';
      });
  };

  const activityHtml = (e) => {
    const summary = describe(e);
    if (!summary) return null;
    return `<li><span class="featured-card__activity-icon">${summary.icon}</span> ${summary.text} <span class="featured-card__activity-time">${formatDate(e.created_at)}</span></li>`;
  };

  const describe = (e) => {
    switch (e.type) {
      case 'PullRequestEvent':
        if (!e.pr_title) return null;
        return {
          icon: e.pr_merged ? '✓' : '↻',
          text: `${e.pr_merged ? 'merged' : e.action || 'updated'} <a href="${escape(e.pr_url)}" target="_blank" rel="noopener">#${e.pr_number} ${escape(e.pr_title)}</a>`,
        };
      case 'ReleaseEvent':
        if (!e.release_tag) return null;
        return {
          icon: '⛳',
          text: `released <a href="${escape(e.release_url)}" target="_blank" rel="noopener">${escape(e.release_name || e.release_tag)}</a>`,
        };
      case 'IssuesEvent':
        if (!e.issue_title) return null;
        return {
          icon: e.action === 'closed' ? '◉' : '○',
          text: `${e.action} <a href="${escape(e.issue_url)}" target="_blank" rel="noopener">#${e.issue_number} ${escape(e.issue_title)}</a>`,
        };
      case 'PushEvent':
        if (!e.ref) return null;
        const branch = e.ref.replace(/^refs\/heads\//, '');
        const count = e.commit_count || 1;
        return { icon: '➤', text: `pushed ${count} commit${count === 1 ? '' : 's'} to <code>${escape(branch)}</code>` };
      case 'CreateEvent':
        if (e.ref_type === 'tag' && e.ref) return { icon: '✦', text: `tagged <code>${escape(e.ref)}</code>` };
        return null;
      default:
        return null;
    }
  };

  const renderMarkdown = (md) => {
    if (!md) return '';
    return md
      .split(/\n{2,}/)
      .map((para) => `<p>${inline(escape(para.trim())).replace(/\n/g, '<br>')}</p>`)
      .join('');
  };

  const inline = (s) =>
    s
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  const formatNumber = (n) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  };

  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const cssEscape = (s) => s.replace(/(["\\])/g, '\\$1');

  function showError(err) {
    root.innerHTML = '<p class="featured-empty">Failed to load featured projects.</p>';
    console.error(err);
  }

  Promise.all([
    fetch(FEATURED_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))),
    fetch(REPOS_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))),
  ])
    .then(([featured, repos]) => {
      const reposByName = Object.fromEntries(repos.map((r) => [r.full_name, r]));
      const enriched = featured
        .map((entry) => ({ ...entry, meta: reposByName[entry.repo] }))
        .filter((e) => e.meta);
      render(enriched);
    })
    .catch(showError);
})();
