const key = process.env.RENDER_API_KEY;
const headers = { Authorization: 'Bearer ' + key, Accept: 'application/json', 'Content-Type': 'application/json' };

(async () => {
  const services = (await (await fetch('https://api.render.com/v1/services?limit=100', { headers })).json()).map((x) => x.service);
  const names = process.argv[2] ? process.argv[2].split(',') : null;
  for (const s of services) {
    if (names && !names.includes(s.name)) continue;
    const res = await fetch(`https://api.render.com/v1/services/${s.id}/deploys`, {
      method: 'POST', headers, body: JSON.stringify({ clearCache: 'do_not_clear' })
    });
    const d = await res.json();
    console.log(s.name + ': ' + (res.ok ? d.id + ' ' + d.status + ' ' + d.commit.id.slice(0, 7) : 'HTTP ' + res.status + ' ' + d.message));
  }
})();
