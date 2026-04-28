(() => {
  const REPOS_URL = '../data/repos.json';
  const FEATURED_URL = '../data/featured.json';
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
            ${r.homepage ? `<a href="${escape(r.homepage)}" target="_blank" rel="noopener">Site →</a>` : ''}
            ${(f && f.links ? f.links : [])
              .map((l) => `<a href="${escape(l.url)}" target="_blank" rel="noopener">${escape(l.label)} →</a>`)
              .join('')}
            <span class="repo-card__pushed">Updated ${formatDate(r.pushed_at)}</span>
          </div>
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
