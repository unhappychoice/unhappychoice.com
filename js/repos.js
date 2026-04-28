(() => {
  const REPOS_URL = '../data/repos.json';
  const FEATURED_URL = '../data/featured.json';
  const ACTIVITY_BASE = '../data/activity/';
  const root = document.getElementById('repos-root');
  const filterRoot = document.getElementById('repos-filter');
  if (!root) return;

  const render = (repos) => {
    const languages = uniqueLanguages(repos);
    renderFilter(languages, repos);
    renderCards(repos);
  };

  const uniqueLanguages = (repos) =>
    [...new Set(repos.map((r) => r.language).filter(Boolean))].sort();

  const renderFilter = (languages, repos) => {
    if (!filterRoot) return;
    const buttons = ['All', ...languages]
      .map((lang) => `<button type="button" class="filter-chip" data-lang="${lang}">${lang}</button>`)
      .join('');
    filterRoot.innerHTML = buttons;
    filterRoot.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterRoot.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const lang = btn.dataset.lang;
        renderCards(lang === 'All' ? repos : repos.filter((r) => r.language === lang));
      });
    });
    filterRoot.querySelector('.filter-chip').classList.add('active');
  };

  const renderCards = (repos) => {
    if (repos.length === 0) {
      root.innerHTML = '<p class="repos-empty">No repositories match the current filter.</p>';
      return;
    }
    root.innerHTML = repos.map(cardHtml).join('');
    repos.forEach((r) => loadActivity(r.full_name));
  };

  const cardHtml = (r) => {
    const ogUrl = r.og_image || `https://opengraph.githubassets.com/1/${r.full_name}`;
    const f = r._featured;
    return `
      <article class="repo-card">
        <a class="repo-card__hero" href="${escape(r.html_url)}" target="_blank" rel="noopener">
          <img src="${escape(ogUrl)}" alt="${escape(r.full_name)} social preview" loading="lazy" />
        </a>
        <div class="repo-card__body">
          <div class="repo-card__head">
            <h3 class="repo-card__title">
              <a href="${escape(r.html_url)}" target="_blank" rel="noopener">${escape(r.full_name)}</a>
            </h3>
            <div class="repo-card__badges">
              ${r.language ? `<span class="repo-card__lang">${escape(r.language)}</span>` : ''}
              <span class="repo-card__stars" title="Stars">★ ${formatNumber(r.stargazers_count)}</span>
              <span class="repo-card__stars" title="Forks">⑂ ${formatNumber(r.forks_count)}</span>
            </div>
          </div>
          ${renderText(r, f)}
          <div class="repo-card__links">
            <a href="${escape(r.html_url)}" target="_blank" rel="noopener">GitHub →</a>
            ${r.homepage ? `<a href="${escape(r.homepage)}" target="_blank" rel="noopener">Site →</a>` : ''}
            ${(f && f.links ? f.links : [])
              .map((l) => `<a href="${escape(l.url)}" target="_blank" rel="noopener">${escape(l.label)} →</a>`)
              .join('')}
            <span class="repo-card__pushed">Updated ${formatDate(r.pushed_at)}</span>
          </div>
          <div class="repo-card__activity" data-repo="${escape(r.full_name)}"></div>
        </div>
      </article>
    `;
  };

  const renderText = (r, f) => {
    if (f && f.text) {
      return `<div class="repo-card__story">${renderMarkdown(f.text)}</div>`;
    }
    return r.description ? `<p class="repo-card__desc">${escape(r.description)}</p>` : '';
  };

  const loadActivity = (fullName) => {
    const slot = root.querySelector(`.repo-card__activity[data-repo="${cssEscape(fullName)}"]`);
    if (!slot) return;
    const url = `${ACTIVITY_BASE}${fullName.replace('/', '__')}.json`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((events) => {
        const items = events.slice(0, 3).map(activityHtml).filter(Boolean);
        if (items.length === 0) return;
        slot.innerHTML = `<h4>Recent activity</h4><ul>${items.join('')}</ul>`;
      })
      .catch(() => {});
  };

  const activityHtml = (e) => {
    const summary = describe(e);
    if (!summary) return null;
    return `<li><span class="repo-card__activity-icon">${summary.icon}</span> ${summary.text} <span class="repo-card__activity-time">${formatDate(e.created_at)}</span></li>`;
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
    root.innerHTML = `<p class="repos-empty">Failed to load repositories. <a href="https://github.com/unhappychoice" target="_blank" rel="noopener">View on GitHub →</a></p>`;
    console.error(err);
  }

  Promise.all([
    fetch(REPOS_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))),
    fetch(FEATURED_URL).then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ])
    .then(([repos, featured]) => {
      const featuredByRepo = Object.fromEntries((featured || []).map((f, i) => [f.repo, { ...f, _order: i }]));
      const enriched = repos
        .filter((r) => !r.archived)
        .map((r) => ({ ...r, _featured: featuredByRepo[r.full_name] || null }))
        .sort((a, b) => {
          const af = a._featured ? a._featured._order : 9999;
          const bf = b._featured ? b._featured._order : 9999;
          if (af !== bf) return af - bf;
          return b.stargazers_count - a.stargazers_count;
        });
      render(enriched);
    })
    .catch(showError);
})();
