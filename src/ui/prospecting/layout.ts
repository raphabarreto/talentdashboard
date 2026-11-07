export function prospectingHtml(): string {
  return `
    <div class="space-y-6">
      <div>
        <div class="flex flex-wrap gap-3 items-end">
          <div class="relative">
            <label class="text-xs text-slate-400 block mb-1">Categoria</label>
            <input id="prospectCategoryInput" type="text" placeholder="Ex.: VALORANT" class="h-10 px-4 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[260px]">
            <div id="prospectCategorySuggestions" class="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg hidden max-h-48 overflow-y-auto"></div>
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Idioma</label>
            <select id="prospectLanguage" class="filter-select h-10 pl-4 cursor-pointer rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[150px]">
              <option value="pt">Português</option>
              <option value="es">Espanhol</option>
              <option value="">Todos</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Viewers mín.</label>
            <input id="prospectMinViewers" type="number" value="50" class="h-10 px-4 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[110px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
          </div>
          <button id="prospectSearchBtn" class="h-10 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-search text-xs"></i>Buscar</button>
        </div>
      </div>

      <div id="prospectResults" class="hidden">
        <div class="flex flex-wrap items-center gap-4 mb-3">
          <p id="prospectCounter" class="text-sm text-slate-400"></p>
          <div id="prospectActions">
            <button id="addToListBtn" disabled title="Marque streamers na tabela abaixo" class="h-10 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 rounded-lg text-sm transition-colors cursor-pointer disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed"><i class="fas fa-plus text-xs"></i><span>Adicionar à Minha Lista (<span id="prospectSelectedCount">0</span>)</span></button>
          </div>
        </div>
        <div class="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
          <table class="w-full min-w-[640px] table-fixed text-left">
            <thead class="border-b border-slate-700 text-sm text-slate-400">
              <tr>
                <th class="p-3 w-12"><input type="checkbox" id="prospectSelectAll" class="w-4 h-4 rounded"></th>
                <th class="p-3 w-[calc(26%-3rem)]">Streamer</th>
                <th class="p-3 w-[32%]">Categoria</th>
                <th class="p-3 w-24 text-center">Viewers</th>
                <th class="p-3">Email</th>
              </tr>
            </thead>
            <tbody id="prospectBody" class="divide-y divide-slate-700"></tbody>
          </table>
        </div>
        <div id="prospectPagination" class="flex items-center justify-center gap-4 mt-4"></div>
      </div>

      <div id="shortlistSection" class="hidden">
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <h3 class="text-white font-semibold text-base mr-2"><i class="fas fa-list mr-2"></i>Minha Lista (<span id="shortlistCount">0</span>)</h3>
          <div class="flex">
            <input id="manualAddInput" type="text" placeholder="Adicionar pelo nome na Twitch..." class="h-10 bg-slate-800 border border-slate-700 text-white text-sm rounded-l-lg px-3 w-60 placeholder-slate-400 focus:outline-none focus:border-indigo-500">
            <button id="manualAddBtn" class="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 rounded-r-lg text-sm transition-colors cursor-pointer" title="Adicionar à Minha Lista"><i class="fas fa-plus"></i></button>
          </div>
          <button id="copyListBtn" class="h-10 flex items-center gap-2 border border-slate-600 text-slate-200 hover:bg-slate-700 font-semibold px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-copy text-xs"></i>Copiar Lista</button>
          <button id="clearListBtn" class="h-10 flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 rounded-lg text-sm transition-colors cursor-pointer" title="Apaga todos os streamers da Minha Lista"><i class="fas fa-trash text-xs"></i>Limpar lista</button>
        </div>
        <div class="rounded-lg border border-slate-700 bg-slate-800">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[640px] table-fixed text-left">
              <thead class="border-b border-slate-700 text-sm text-slate-400 sticky top-0 bg-slate-800">
                <tr>
                  <th class="p-3 w-[26%]">Streamer</th>
                  <th class="p-3 w-[32%]">Categoria</th>
                  <th class="p-3">Email</th>
                  <th class="p-3 w-20 text-center">Ações</th>
                </tr>
              </thead>
              <tbody id="shortlistBody" class="divide-y divide-slate-700"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
}

export function getElements() {
  return {
    input: document.getElementById('prospectCategoryInput') as HTMLInputElement,
    suggestions: document.getElementById('prospectCategorySuggestions')!,
    searchBtn: document.getElementById('prospectSearchBtn') as HTMLButtonElement,
    language: document.getElementById('prospectLanguage') as HTMLSelectElement,
    minViewers: document.getElementById('prospectMinViewers') as HTMLInputElement,
    selectAll: document.getElementById('prospectSelectAll') as HTMLInputElement,
    addToListBtn: document.getElementById('addToListBtn')!,
    copyListBtn: document.getElementById('copyListBtn')!,
    clearListBtn: document.getElementById('clearListBtn')!,
    manualAddBtn: document.getElementById('manualAddBtn')!,
    manualAddInput: document.getElementById('manualAddInput') as HTMLInputElement,
    prospectBody: document.getElementById('prospectBody')!,
    shortlistBody: document.getElementById('shortlistBody')!
  }
}

export type Els = ReturnType<typeof getElements>
