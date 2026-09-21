// Upstash Redis over its REST API: one POST carries a whole pipeline. No SDK needed.
export async function redis(commands, { readOnly = false } = {}) {
  const url = process.env.KV_REST_API_URL;
  const token = readOnly ? (process.env.KV_REST_API_READ_ONLY_TOKEN || process.env.KV_REST_API_TOKEN) : process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('No stats database is connected to this deployment');
  const response = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  if (!response.ok) throw new Error(`Stats database answered ${response.status}`);
  const entries = await response.json();
  const failed = entries.find(entry => entry.error);
  if (failed) throw new Error(`Stats database: ${failed.error}`);
  return entries.map(entry => entry.result);
}
