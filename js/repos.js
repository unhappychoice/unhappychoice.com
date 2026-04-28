(() => {
  const REPOS_URL = '../data/repos.json';
  const FEATURED_URL = '../data/featured.json';
  const ACTIVITY_BASE = '../data/activity/';
  const root = document.getElementById('repos-root');
  const filterRoot = document.getElementById('repos-filter');
  const modal = document.getElementById('repo-modal');
  const modalContent = document.getElementById('repo-modal-content');
  if (!root) return;

  const state = { byName: {} };

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
      <article class="repo-card" data-repo="${escape(r.full_name)}">
        <div class="repo-card__hero">
          <img src="${escape(ogUrl)}" alt="${escape(r.full_name)} social preview" loading="lazy" />
        </div>
        <div class="repo-card__body">
          <div class="repo-card__head">
            <h3 class="repo-card__title">${escape(r.full_name)}</h3>
            <div class="repo-card__badges">
              ${r.language ? `<span class="repo-card__lang">${escape(r.language)}</span>` : ''}
              <span class="repo-card__stars" title="Stars">★ ${formatNumber(r.stargazers_count)}</span>
              <span class="repo-card__stars" title="Forks">⑂ ${formatNumber(r.forks_count)}</span>
            </div>
          </div>
          ${renderText(r, f)}
          <div class="repo-card__links">
            ${r.homepage ? `<a href="${escape(r.homepage)}" target="_blank" rel="noopener">Site →</a>` : ''}
            <a href="${escape(r.html_url)}" target="_blank" rel="noopener">GitHub →</a>
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

  const formatAbsoluteDate = (iso) => {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  };

  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── Modal ─────────────────────────────────────────────────────────

  const openModal = (fullName) => {
    const r = state.byName[fullName];
    if (!r) return;
    renderModal(r);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    fetch(`${ACTIVITY_BASE}${fullName.replace('/', '__')}.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((events) => renderModalActivity(events))
      .catch(() => renderModalActivity([]));
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
  };

  const renderModal = (r) => {
    const ogUrl = r.og_image || `https://opengraph.githubassets.com/1/${r.full_name}`;
    const f = r._featured;
    const links = [
      { label: 'GitHub', url: r.html_url },
      ...(r.homepage ? [{ label: 'Homepage', url: r.homepage }] : []),
      ...((f && f.links) || []),
    ];
    modalContent.innerHTML = `
      <div class="modal__hero">
        <img src="${escape(ogUrl)}" alt="${escape(r.full_name)} social preview" />
      </div>
      <div class="modal__body">
        <h2 id="repo-modal-title" class="modal__title">
          <a href="${escape(r.html_url)}" target="_blank" rel="noopener">${escape(r.full_name)}</a>
        </h2>
        <div class="modal__meta">
          ${r.language ? `<span class="modal__lang">${escape(r.language)}</span>` : ''}
          <span title="Stars">★ ${formatNumber(r.stargazers_count)}</span>
          <span title="Forks">⑂ ${formatNumber(r.forks_count)}</span>
          <span title="Open issues">○ ${formatNumber(r.open_issues_count)}</span>
          <span class="modal__dates">Created ${formatAbsoluteDate(r.created_at)} · Updated ${formatDate(r.pushed_at)}</span>
        </div>
        ${r.description ? `<p class="modal__desc">${escape(r.description)}</p>` : ''}
        ${f && f.text ? `<div class="modal__story">${renderMarkdown(f.text)}</div>` : ''}
        ${renderModalTopics(r.topics)}
        <div class="modal__links">
          ${links.map((l) => `<a href="${escape(l.url)}" target="_blank" rel="noopener">${escape(l.label)} →</a>`).join('')}
        </div>
        <div class="modal__activity">
          <h3>Recent activity</h3>
          <p class="modal__activity-loading">Loading…</p>
        </div>
      </div>
    `;
  };

  const renderModalTopics = (topics) => {
    if (!topics || topics.length === 0) return '';
    return `<div class="modal__topics">${topics
      .map((t) => `<span class="modal__topic">${escape(t)}</span>`)
      .join('')}</div>`;
  };

  const renderModalActivity = (events) => {
    const slot = modalContent.querySelector('.modal__activity');
    if (!slot) return;
    const items = events.slice(0, 15).map(activityHtml).filter(Boolean);
    if (items.length === 0) {
      slot.innerHTML = '<h3>Recent activity</h3><p class="modal__activity-empty">No recent public activity.</p>';
      return;
    }
    slot.innerHTML = `<h3>Recent activity</h3><ul class="modal__activity-list">${items.join('')}</ul>`;
  };

  const activityHtml = (e) => {
    const summary = describe(e);
    if (!summary) return null;
    return `
      <li class="modal__activity-item">
        <span class="modal__activity-icon">${summary.icon}</span>
        <span class="modal__activity-text">${summary.text}</span>
        <span class="modal__activity-time">${formatDate(e.created_at)}</span>
      </li>
    `;
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

  const onHashChange = () => {
    const m = location.hash.match(/^#repo=([^&]+)/);
    if (m) openModal(decodeURIComponent(m[1]));
    else closeModal();
  };

  const wireInteractions = () => {
    root.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const card = e.target.closest('.repo-card');
      if (!card) return;
      const repo = card.dataset.repo;
      if (repo) location.hash = `repo=${encodeURIComponent(repo)}`;
    });
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-modal-close]')) {
        history.pushState('', document.title, location.pathname + location.search);
        closeModal();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) {
        history.pushState('', document.title, location.pathname + location.search);
        closeModal();
      }
    });
    window.addEventListener('hashchange', onHashChange);
  };

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
      enriched.forEach((r) => (state.byName[r.full_name] = r));
      render(enriched);
      wireInteractions();
      onHashChange();
    })
    .catch(showError);
})();
