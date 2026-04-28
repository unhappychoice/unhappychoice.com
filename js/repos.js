(() => {
  const DATA_URL = '../data/repos.json';
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

  const cardHtml = (repo) => `
    <article class="repo-card">
      <header class="repo-card__header">
        <h3 class="repo-card__title">
          <a href="${escape(repo.html_url)}" target="_blank" rel="noopener">${escape(repo.full_name)}</a>
        </h3>
        ${repo.language ? `<span class="repo-card__lang">${escape(repo.language)}</span>` : ''}
      </header>
      ${repo.description ? `<p class="repo-card__desc">${escape(repo.description)}</p>` : ''}
      ${renderTopics(repo.topics)}
      <footer class="repo-card__footer">
        <span title="Stars">★ ${formatNumber(repo.stargazers_count)}</span>
        <span title="Forks">⑂ ${formatNumber(repo.forks_count)}</span>
        <span title="Last push" class="repo-card__pushed">Updated ${formatDate(repo.pushed_at)}</span>
        ${repo.homepage ? `<a class="repo-card__homepage" href="${escape(repo.homepage)}" target="_blank" rel="noopener">Site</a>` : ''}
      </footer>
    </article>
  `;

  const renderTopics = (topics) => {
    if (!topics || topics.length === 0) return '';
    const shown = topics.slice(0, 6);
    return `<div class="repo-card__topics">${shown
      .map((t) => `<span class="repo-card__topic">${escape(t)}</span>`)
      .join('')}</div>`;
  };

  const formatNumber = (n) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'today';
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function showError(err) {
    root.innerHTML = `<p class="repos-empty">Failed to load repositories. <a href="https://github.com/unhappychoice" target="_blank" rel="noopener">View on GitHub →</a></p>`;
    console.error(err);
  }

  fetch(DATA_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
    .then((repos) => render(repos.filter((r) => !r.archived)))
    .catch(showError);
})();
