// Importar SEMPRE como primeira linha dos scripts. Os logs do Actions são públicos e o Node inclui trechos do conteúdo
// em erros de JSON.parse (ex.: `Unexpected token 'b', "bad pessoa"... is not valid JSON`). Qualquer exceção não tratada
// vira uma mensagem genérica, sem detalhes.
const fail = (e) => {
  console.error(`::error::falha inesperada (${e?.name ?? 'erro'}); detalhes omitidos de proposito para nao expor dados em logs publicos`)
  process.exit(1)
}
process.on('uncaughtException', fail)
process.on('unhandledRejection', fail)
