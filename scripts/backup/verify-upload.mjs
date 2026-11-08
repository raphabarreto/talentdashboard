import './safe.mjs'
// Confirma, depois do upload, que o GitHub guardou o artifact: existe, não expirou, tem tamanho e o hash (digest) bate
// com o informado pela ação de upload. Env: GH_TOKEN, GITHUB_REPOSITORY, ARTIFACT_ID, ARTIFACT_DIGEST, EXPECTED_NAME.
const { GH_TOKEN, GITHUB_REPOSITORY, ARTIFACT_ID, ARTIFACT_DIGEST, EXPECTED_NAME } = process.env
const die = (m) => { console.error(`::error::${m}`); process.exit(1) }
if (!ARTIFACT_ID) die('upload nao devolveu o id do artifact')
if (!ARTIFACT_DIGEST) die('upload nao devolveu o hash (digest) do artifact')
const norm = (d) => String(d).replace(/^sha256:/, '').toLowerCase()

let last = 'sem resposta'
for (let i = 1; i <= 5; i++) {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/artifacts/${ARTIFACT_ID}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30_000),
    })
    if (res.ok) {
      const a = await res.json()
      const problems = []
      if (a.name !== EXPECTED_NAME) problems.push('nome diferente')
      if (a.expired) problems.push('expirado')
      if (!(a.size_in_bytes > 0)) problems.push('tamanho zero')
      if (!a.digest || norm(a.digest) !== norm(ARTIFACT_DIGEST)) problems.push('hash diferente do enviado')
      if (problems.length) die(`artifact nao confere: ${problems.join(', ')}`)
      console.log(`upload verificado: ${a.name}, ${a.size_in_bytes} bytes, expira em ${a.expires_at}`)
      process.exit(0)
    }
    last = `HTTP ${res.status}`
  } catch (e) { last = e?.name ?? 'erro' }
  await new Promise((r) => setTimeout(r, i * 3000))
}
die(`nao foi possivel verificar o upload (${last})`)
