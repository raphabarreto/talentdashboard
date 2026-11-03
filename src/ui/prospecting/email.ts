const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/g

const DEFAULT_TEMPLATE_PT = `Fala {streamer}, tudo bem?

Sou o Raphael Barreto, responsável pelas campanhas na Lugs Hub.

Acompanho seu conteúdo e selecionei seu canal para uma possível parceria com o {empresa} neste mês.

Pelo perfil da sua comunidade e seu estilo de live, acho que a ação encaixa muito bem.

A proposta tem uma parte fixa garantida, além de um bônus por performance.

Se tiver interesse, me dá um salve por aqui, pelo Discord (raphalugs) ou WhatsApp 11976732064, que te passo todos os detalhes.

Abraço!`

const DEFAULT_TEMPLATE_ES = `Buenas, {streamer}

Soy Raphael Barreto, responsable de campañas en Lugs Hub.

Sigo tu contenido y he seleccionado tu canal para una posible colaboración con {empresa} durante este mes.

Por el perfil de tu comunidad y tu estilo de directos, creo que la acción encaja muy bien con lo que buscamos.

La propuesta incluye una parte fija garantizada más incentivos por resultados.

Si te interesa, avísame por aquí o por Discord (raphalugs) y te paso todos los detalles.

¡Un saludo!`

export function extractEmail(description: string): string | null {
  const matches = description.match(EMAIL_REGEX)
  return matches?.[0] || null
}

export function getTemplate(lang: string): string {
  if (lang === 'es') return DEFAULT_TEMPLATE_ES
  return DEFAULT_TEMPLATE_PT
}

export function getCompany(): string {
  return (document.getElementById('prospectCompany') as HTMLInputElement)?.value.trim() || ''
}

// Assunto e corpo do e-mail de proposta para um streamer.
export function buildProposal(r: { user_name: string; language: string }, company: string) {
  const body = getTemplate(r.language).replace(/{streamer}/g, r.user_name).replace(/{empresa}/g, company)
  const subject = r.language === 'es' ? `Propuesta de Colaboración ${r.user_name} x ${company}` : `Proposta de colaboração ${r.user_name} x ${company}`
  return { subject, body }
}
