(() => {
  const DATA_URL = '../data/stats.json';
  const root = document.getElementById('stats-root');
  if (!root) return;

  fetch(DATA_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
    .then(render)
    .catch(showError);

  const render = (stats) => {
    root.innerHTML = `
      ${renderTotals(stats)}
      ${renderLanguages(stats.languages)}
      ${renderOwners(stats.by_owner)}
      ${renderUpdated(stats.generated_at)}
    `;
  };

  const renderTotals = (stats) => `
    <div class="stats-totals">
      ${tile('Repositories', stats.total_repos)}
      ${tile('Total stars', stats.total_stars)}
      ${tile('Total forks', stats.total_forks)}
      ${tile('Archived', stats.archived_count)}
    </div>
  `;

  const tile = (label, value) => `
    <div class="stats-tile">
      <div class="stats-tile__value">${formatNumber(value)}</div>
      <div class="stats-tile__label">${escape(label)}</div>
    </div>
  `;

  const renderLanguages = (languages) => {
    if (!languages || languages.length === 0) return '';
    const total = languages.reduce((acc, l) => acc + l.count, 0);
    const bars = languages
      .map((l) => {
        const pct = ((l.count / total) * 100).toFixed(1);
        return `
          <div class="stats-bar">
            <div class="stats-bar__label"><span>${escape(l.language)}</span><span>${l.count} (${pct}%)</span></div>
            <div class="stats-bar__track"><div class="stats-bar__fill" style="width:${pct}%"></div></div>
          </div>
        `;
      })
      .join('');
    return `<div class="stats-section"><h3>Languages</h3>${bars}</div>`;
  };

  const renderOwners = (owners) => {
    if (!owners || owners.length === 0) return '';
    const rows = owners
      .map(
        (o) => `
          <tr>
            <td><a href="https://github.com/${escape(o.owner)}" target="_blank" rel="noopener">${escape(o.owner)}</a></td>
            <td>${o.repo_count}</td>
            <td>★ ${formatNumber(o.stars)}</td>
          </tr>
        `,
      )
      .join('');
    return `
      <div class="stats-section">
        <h3>By organization</h3>
        <table class="stats-table">
          <thead><tr><th>Owner</th><th>Repos</th><th>Stars</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  const renderUpdated = (iso) => {
    if (!iso) return '';
    return `<p class="stats-updated">Snapshot updated ${escape(iso)}</p>`;
  };

  const formatNumber = (n) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };

  const escape = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function showError(err) {
    root.innerHTML = '<p class="stats-empty">Failed to load stats.</p>';
    console.error(err);
  }
})();
