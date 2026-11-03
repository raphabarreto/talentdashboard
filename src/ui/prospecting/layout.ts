export function prospectingHtml(): string {
  return `
    <div class="space-y-6">
      <div class="flex flex-wrap gap-4 items-end">
        <div class="relative">
          <label class="text-sm font-semibold text-white block mb-1">Categoria</label>
          <input id="prospectCategoryInput" type="text" placeholder="Buscar categoria..." class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[260px]">
          <div id="prospectCategorySuggestions" class="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg hidden max-h-48 overflow-y-auto"></div>
        </div>
        <div>
          <label class="text-sm font-semibold text-white block mb-1">Idioma</label>
          <select id="prospectLanguage" class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[140px]">
            <option value="pt">Português</option>
            <option value="es">Espanhol</option>
            <option value="">Todos</option>
          </select>
        </div>
        <div>
          <label class="text-sm font-semibold text-white block mb-1">Viewers mín.</label>
          <input id="prospectMinViewers" type="number" value="50" class="px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-[100px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
        </div>
        <button id="prospectSearchBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors cursor-pointer">Buscar</button>
        <label class="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none"><input type="checkbox" id="prospectOnlyEmail" class="w-4 h-4 rounded accent-indigo-500"> Só com email</label>
      </div>

      <div id="prospectActions" class="flex gap-3 hidden">
        <button id="addToListBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-plus"></i> Adicionar à Lista (<span id="prospectSelectedCount">0</span>)</button>
      </div>

      <div id="prospectResults" class="hidden">
        <div class="flex items-center justify-between mb-3">
          <p id="prospectCounter" class="text-sm text-slate-400"></p>
        </div>
        <div class="overflow-x-auto rounded-lg border border-slate-700 bg-slate-800">
          <table class="w-full text-left">
            <thead class="border-b border-slate-700 text-sm text-slate-400">
              <tr>
                <th class="p-4 w-10"><input type="checkbox" id="prospectSelectAll" class="w-4 h-4 rounded"></th>
                <th class="p-4 w-[25%]">Streamer</th>
                <th class="p-4 w-[20%]">Categoria</th>
                <th class="p-4 w-[80px] text-center">Viewers</th>
                <th class="p-4 w-[25%]">Email</th>
              </tr>
            </thead>
            <tbody id="prospectBody" class="divide-y divide-slate-700"></tbody>
          </table>
        </div>
        <div id="prospectPagination" class="flex items-center justify-center gap-4 mt-4"></div>
      </div>

      <div id="shortlistSection" class="hidden">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-white font-semibold text-base"><i class="fas fa-list mr-2"></i>Minha Lista (<span id="shortlistCount">0</span>)</h3>
          <div class="flex gap-3">
            <div class="flex">
              <input id="manualAddInput" type="text" placeholder="Adicionar streamer..." class="bg-slate-700 border border-slate-600 text-white text-sm rounded-l-lg px-3 py-2 w-44 placeholder-slate-400 focus:outline-none focus:border-indigo-500">
              <button id="manualAddBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-2 rounded-r-lg text-sm transition-colors cursor-pointer"><i class="fas fa-plus"></i></button>
            </div>
            <button id="copyListBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-copy mr-1"></i>Copiar Lista</button>
            <button id="clearListBtn" class="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors cursor-pointer"><i class="fas fa-trash mr-1"></i>Limpar</button>
          </div>
        </div>
        <div class="rounded-lg border border-slate-700 bg-slate-800">
          <div class="overflow-x-auto overflow-y-auto max-h-[480px]">
            <table class="w-full text-left">
              <thead class="border-b border-slate-700 text-sm text-slate-400 sticky top-0 bg-slate-800">
                <tr>
                  <th class="p-3">Streamer</th>
                  <th class="p-3">Categoria</th>
                  <th class="p-3">Email</th>
                  <th class="p-3 w-[120px]">Ações</th>
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
    onlyEmail: document.getElementById('prospectOnlyEmail') as HTMLInputElement,
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
