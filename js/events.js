(() => {
  const DATA_URL = '../data/events.json';
  const root = document.getElementById('events-root');
  if (!root) return;

  fetch(DATA_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
    .then(render)
    .catch(showError);

  const render = (events) => {
    const items = events.slice(0, 20).map(itemHtml).filter(Boolean);
    if (items.length === 0) {
      root.innerHTML = '<p class="events-empty">No recent activity.</p>';
      return;
    }
    root.innerHTML = `<ul class="events-list">${items.join('')}</ul>`;
  };

  const itemHtml = (e) => {
    const summary = describe(e);
    if (!summary) return null;
    return `
      <li class="event-item">
        <span class="event-item__icon">${summary.icon}</span>
        <div class="event-item__body">
          <div class="event-item__text">${summary.text}</div>
          <div class="event-item__meta">
            <a href="https://github.com/${escape(e.repo)}" target="_blank" rel="noopener">${escape(e.repo)}</a>
            <span class="event-item__time">${formatDate(e.created_at)}</span>
          </div>
        </div>
      </li>
    `;
  };

  const describe = (e) => {
    const repoUrl = `https://github.com/${escape(e.repo)}`;
    switch (e.type) {
      case 'PullRequestEvent':
        if (!e.pr_title) return null;
        const verb = e.pr_merged ? 'merged' : e.action || 'updated';
        return {
          icon: e.pr_merged ? '✓' : '↻',
          text: `${verb} PR <a href="${escape(e.pr_url || repoUrl)}" target="_blank" rel="noopener">#${e.pr_number} ${escape(e.pr_title)}</a>`,
        };
      case 'ReleaseEvent':
        if (!e.release_tag) return null;
        return {
          icon: '⛳',
          text: `released <a href="${escape(e.release_url || repoUrl)}" target="_blank" rel="noopener">${escape(e.release_name || e.release_tag)}</a>`,
        };
      case 'IssuesEvent':
        if (!e.issue_title) return null;
        return {
          icon: e.action === 'closed' ? '◉' : '○',
          text: `${e.action || 'updated'} issue <a href="${escape(e.issue_url || repoUrl)}" target="_blank" rel="noopener">#${e.issue_number} ${escape(e.issue_title)}</a>`,
        };
      case 'PushEvent':
        if (!e.ref) return null;
        const branch = e.ref.replace(/^refs\/heads\//, '');
        const count = e.commit_count || 1;
        return {
          icon: '➤',
          text: `pushed ${count} commit${count === 1 ? '' : 's'} to <code>${escape(branch)}</code>`,
        };
      case 'CreateEvent':
        if (e.ref_type !== 'repository' && e.ref_type !== 'tag' && e.ref_type !== 'branch') return null;
        return {
          icon: '✦',
          text: `created ${escape(e.ref_type)}${e.ref ? ` <code>${escape(e.ref)}</code>` : ''}`,
        };
      default:
        return null;
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function showError(err) {
    root.innerHTML = '<p class="events-empty">Failed to load recent activity.</p>';
    console.error(err);
  }
})();
