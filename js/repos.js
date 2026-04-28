(() => {
  const REPOS_URL = '../data/repos.json';
  const FEATURED_URL = '../data/featured.json';
  const ACTIVITY_BASE = '../data/activity/';
  const root = document.getElementById('repos-root');
  const filterRoot = document.getElementById('repos-filter');
  const sortSelect = document.getElementById('repos-sort');
  const modal = document.getElementById('repo-modal');
  const modalContent = document.getElementById('repo-modal-content');
  if (!root) return;

  const state = { byName: {}, repos: [], lang: 'All', sort: 'featured' };

  const render = (repos) => {
    state.repos = repos;
    renderFilter(uniqueLanguages(repos));
    if (sortSelect) {
      sortSelect.value = state.sort;
      sortSelect.addEventListener('change', () => {
        state.sort = sortSelect.value;
        rerender();
      });
    }
    rerender();
  };

  const HIDDEN_LANGS = new Set(['HTML', 'Shell']);
  const LANG_ORDER = ['TypeScript', 'Rust', 'Ruby', 'Kotlin', 'Swift'];

  const uniqueLanguages = (repos) => {
    const langs = [...new Set(repos.map((r) => r.language).filter((l) => l && !HIDDEN_LANGS.has(l)))];
    return langs.sort((a, b) => {
      const ai = LANG_ORDER.indexOf(a);
      const bi = LANG_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  };

  const renderFilter = (languages) => {
    if (!filterRoot) return;
    const buttons = ['All', ...languages]
      .map((lang) => `<button type="button" class="filter-chip" data-lang="${escape(lang)}">${escape(lang)}</button>`)
      .join('');
    filterRoot.innerHTML = buttons;
    filterRoot.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterRoot.querySelectorAll('.filter-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.lang = btn.dataset.lang;
        rerender();
      });
    });
    filterRoot.querySelector('.filter-chip').classList.add('active');
  };

  const rerender = () => {
    const filtered = state.lang === 'All' ? state.repos : state.repos.filter((r) => r.language === state.lang);
    renderCards(applySort(filtered, state.sort));
  };

  const applySort = (repos, sort) => {
    const list = repos.slice();
    switch (sort) {
      case 'stars':
        return list.sort((a, b) => b.stargazers_count - a.stargazers_count);
      case 'updated':
        return list.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
      case 'created':
        return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      case 'featured':
      default:
        return list.sort((a, b) => {
          const af = a._featured ? a._featured._order : 9999;
          const bf = b._featured ? b._featured._order : 9999;
          if (af !== bf) return af - bf;
          return b.stargazers_count - a.stargazers_count;
        });
    }
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

  const formatNumber = (n) => n.toLocaleString('en-US');

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

  const withTransition = (fn) => {
    if (document.startViewTransition) document.startViewTransition(fn);
    else fn();
  };

  const openModal = (fullName) => {
    const r = state.byName[fullName];
    if (!r) return;
    renderModal(r);
    withTransition(() => {
      modal.hidden = false;
      document.body.classList.add('modal-open');
    });
    fetch(`${ACTIVITY_BASE}${fullName.replace('/', '__')}.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((events) => renderModalActivity(events))
      .catch(() => renderModalActivity([]));
  };

  const closeModal = () => {
    if (modal.hidden) return;
    withTransition(() => {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    });
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
        <div class="modal__releases"></div>
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
    renderReleases(events.filter((e) => e.type === 'ReleaseEvent'));
    renderRecentActivity(events.filter((e) => e.type !== 'ReleaseEvent'));
  };

  const renderReleases = (releases) => {
    const slot = modalContent.querySelector('.modal__releases');
    if (!slot) return;
    if (releases.length === 0) {
      slot.innerHTML = '';
      return;
    }
    const items = releases.slice(0, 5).map(releaseHtml).join('');
    slot.innerHTML = `<h3>Releases</h3><ul class="modal__release-list">${items}</ul>`;
  };

  const releaseHtml = (e) => `
    <li class="modal__release-item">
      <a class="modal__release-tag" href="${escape(e.release_url)}" target="_blank" rel="noopener">${escape(e.release_tag)}</a>
      ${e.release_name && e.release_name !== e.release_tag ? `<span class="modal__release-name">${escape(e.release_name)}</span>` : ''}
      <span class="modal__release-time">${formatDate(e.created_at)}</span>
    </li>
  `;

  const renderRecentActivity = (events) => {
    const slot = modalContent.querySelector('.modal__activity');
    if (!slot) return;
    const items = events.slice(0, 20).map(activityHtml).filter(Boolean);
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
        .map((r) => ({ ...r, _featured: featuredByRepo[r.full_name] || null }));
      enriched.forEach((r) => (state.byName[r.full_name] = r));
      render(enriched);
      wireInteractions();
      onHashChange();
    })
    .catch(showError);
})();
