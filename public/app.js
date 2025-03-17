const API_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000/api/supabase"
    : "/api/supabase";

let selectedItems = new Map();
let currentLote = 1;

// Debounce para otimizar buscas
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function formatarNumero(numero) {
    if (!numero || isNaN(numero)) return "0,00";
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Formata telefone no input
function formatarTelefone(input) {
    input.value = input.value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

// Busca itens na API
async function fetchItems() {
    const search = document.getElementById("searchInput").value || "";
    const lote = currentLote;

    try {
        const response = await fetch(`${API_URL}?search=${encodeURIComponent(search)}&lote=${lote}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao buscar itens.");
        renderTable(data);
    } catch (error) {
        document.getElementById('tableBody').innerHTML =
            `<tr><td colspan="10">${error.message}</td></tr>`;
    }
}

// Renderiza a tabela principal
    function renderTable(items) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    items.sort((a, b) => a.item - b.item).forEach(item => {
        const isChecked = selectedItems.has(item.item);
        const quantidadeMensal = isChecked ? selectedItems.get(item.item).quantidade_mensal : 0;
        const qtdeMinima = item.qtde_minima || 1;

        let quantidadeTotal, valorUnTotal, valorTotal;

        // 🔹 Ajuste para LOTE 2, 3 e 4
        if ([2, 3, 4].includes(Number(item.lote))) {
            quantidadeTotal = quantidadeMensal; // Sem multiplicar por 36
            valorUnTotal = parseFloat(item.valor_un_total) || 0; // Usa o valor_un_total diretamente
            valorTotal = quantidadeMensal * valorUnTotal; // Multiplicação correta
        } else {
            // 🔹 Para LOTE 1 (mantém a lógica antiga)
            quantidadeTotal = quantidadeMensal * 36;
            valorUnTotal = parseFloat(item.valor_un_mensal) * 36;
            valorTotal = quantidadeMensal * valorUnTotal;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="item-checkbox" data-id="${item.item}" data-desc="${item.desc_catmas}" data-valor="${item.valor_un_mensal}" data-min="${qtdeMinima}" data-lote="${item.lote}" data-alerta="${item.alerta || ''}" ${isChecked ? 'checked' : ''}></td>
            <td>${item.item}</td>
            <td>${item.cod_catmas || '-'}</td>
            <td>${item.sku || '-'}</td>
            <td>${item.desc_catmas}</td>
            <td>R$ ${formatarNumero(item.valor_un_mensal)}</td>
            <td><input type="number" class="quantidade-input" data-id="${item.item}" value="${quantidadeMensal}" min="${qtdeMinima}" ${isChecked ? '' : 'disabled'}></td>
            <td class="quantidade-total" data-id="${item.item}">${quantidadeTotal}</td>
            <td class="valor-un-total" data-id="${item.item}">R$ ${formatarNumero(valorUnTotal)}</td>
            <td class="valor-total" data-id="${item.item}">R$ ${formatarNumero(valorTotal)}</td>`;
        tbody.appendChild(tr);
    });

    addEventListeners();
    updateSelectedItems();
    }


// Atualiza dinamicamente uma linha específica da tabela
function updateTableRow(id, quantidadeMensal, valorUnMensal, lote) {
    let quantidadeTotal, valorUnTotal, valorTotal;

    if ([2, 3, 4].includes(Number(lote))) {
        quantidadeTotal = quantidadeMensal; 
        valorUnTotal = parseFloat(document.querySelector(`.valor-un-total[data-id="${id}"]`).textContent.replace("R$ ", "").replace(",", ".")) || 0;
        valorTotal = quantidadeMensal * valorUnTotal;
    } else {
        quantidadeTotal = quantidadeMensal * 36;
        valorUnTotal = valorUnMensal * 36;
        valorTotal = quantidadeMensal * valorUnTotal;
    }

    document.querySelector(`.quantidade-total[data-id="${id}"]`).textContent = quantidadeTotal;
    document.querySelector(`.valor-total[data-id="${id}"]`).textContent = `R$ ${formatarNumero(valorTotal)}`;
}


// Atualiza lista lateral de itens selecionados
function updateSelectedItems() {
    const selectedList = document.getElementById('selectedList');
    selectedList.innerHTML = '';
    selectedItems.forEach((data, id) => {
        selectedList.innerHTML += `
            <li>
                <strong>${id}:</strong> ${data.desc}<br>
                Qtde mensal: ${data.quantidade_mensal}<br>
                Valor total: R$ ${formatarNumero(data.quantidade_mensal * data.valor * 36)}
            </li>`;
    });
}

// Eventos principais (checkboxes, filtros, inputs)
function addEventListeners() {
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.addEventListener('change', function () {
            const { id, desc, valor, min, alerta } = this.dataset;
            const quantidadeInput = document.querySelector(`.quantidade-input[data-id="${id}"]`);
            const alertaDiv = document.getElementById('alerta-item');

            if (this.checked) {
                selectedItems.set(id, { desc, valor: parseFloat(valor), quantidade_mensal: parseInt(min) });
                quantidadeInput.disabled = false;
                quantidadeInput.value = min;
                alertaDiv.textContent = alerta && alerta.trim() !== "" ? alerta : "";
            } else {
                selectedItems.delete(id);
                quantidadeInput.disabled = true;
                quantidadeInput.value = 0;
                alertaDiv.textContent = ""; // Limpa o alerta ao desmarcar
            }
            updateSelectedItems();
        });
    });

    document.querySelectorAll('.quantidade-input').forEach(input => {
        input.addEventListener('input', function () {
            const id = this.dataset.id;
            const lote = document.querySelector(`.item-checkbox[data-id="${id}"]`).dataset.lote;
            let quantidadeMensal = parseInt(this.value) || 0;
            const min = parseInt(this.min);
            if (quantidadeMensal < min) quantidadeMensal = min;
            this.value = quantidadeMensal;
    
            if (selectedItems.has(id)) {
                selectedItems.get(id).quantidade_mensal = quantidadeMensal;
                const valorUnMensal = selectedItems.get(id).valor;
                updateTableRow(id, quantidadeMensal, valorUnMensal, lote);
                updateSelectedItems();
            }
        });
    });
    

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.onclick = function () {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentLote = this.dataset.lote;
            fetchItems();
        };
    });

    document.getElementById('searchInput').oninput = debounce(fetchItems, 300);

    document.getElementById("enviarBtn").onclick = async () => {
        const nome = document.getElementById("nome").value;
        const email = document.getElementById("email").value;
        const telefone = document.getElementById("telefone").value;
        const orgao = document.getElementById("orgao").value;

        if (!nome || !email || !telefone || !orgao || selectedItems.size === 0) {
            return alert("Preencha todos os campos e selecione itens.");
        }

        const itens = Array.from(selectedItems).map(([id, data]) => ({
            item: id,
            desc_catmas: data.desc,
            valor_un_mensal: data.valor,
            qtde_mensal: data.quantidade_mensal,
            qtde_total: data.quantidade_mensal * 36,
            valor_un_total: data.valor * 36,
            valor_total: data.valor * data.quantidade_mensal * 36
        }));

        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, email, telefone, orgao, itens })
        });

        if (res.ok) {
            alert("Itens enviados com sucesso!");
            location.reload();
        } else {
            const err = await res.json();
            alert("Erro ao enviar: " + err.error);
        }
    };
}

fetchItems();
