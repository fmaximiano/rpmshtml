const API_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000/api/supabase"
    : "/api/supabase";

let selectedItems = new Map();
let currentLote = 1;

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

function formatarTelefone(input) {
    input.value = input.value
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

async function fetchItems() {
    const search = document.getElementById("searchInput").value || "";
    const lote = currentLote;

    try {
        const response = await fetch(`${API_URL}?search=${encodeURIComponent(search)}&lote=${lote}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Erro ao buscar itens.");
        renderTable(data);
        updateTableHeaders(lote); // Atualiza cabeçalhos dinamicamente
    } catch (error) {
        document.getElementById('tableBody').innerHTML =
            `<tr><td colspan="10">${error.message}</td></tr>`;
    }
}

function updateTableHeaders(lote) {
    const quantidadeHeader = document.getElementById("quantidadeHeader");
    const valorUnMensalHeader = document.getElementById("valorUnMensalHeader");
    const quantidadeTotalHeader = document.getElementById("quantidadeTotalHeader");

    if (lote == 1) {
        quantidadeHeader.textContent = "Qtde Mensal";
        valorUnMensalHeader.style.display = "table-cell";
        quantidadeTotalHeader.style.display = "table-cell";
    } else {
        quantidadeHeader.textContent = "Quantidade";
        valorUnMensalHeader.style.display = "none";
        quantidadeTotalHeader.style.display = "none";
    }
}

function renderTable(items) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    items.sort((a, b) => a.item - b.item).forEach(item => {
        const isChecked = selectedItems.has(item.item);
        const quantidade = isChecked ? selectedItems.get(item.item).quantidade_mensal : 0;
        const qtdeMinima = item.qtde_minima || 1;
        const lote = Number(item.lote);

        let quantidadeTotal, valorUnTotal, valorTotal;

        if (lote === 1) {
            quantidadeTotal = quantidade * 36;
            valorUnTotal = parseFloat(item.valor_un_mensal) * 36;
            valorTotal = quantidade * valorUnTotal;
        } else {
            quantidadeTotal = quantidade; // Não usado nos Lotes 2, 3, 4
            valorUnTotal = parseFloat(item.valor_un_total) || 0;
            valorTotal = quantidade * valorUnTotal;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="item-checkbox" data-id="${item.item}" data-desc="${item.desc_catmas}" data-valor="${item.valor_un_mensal}" data-valor-total="${item.valor_un_total}" data-min="${qtdeMinima}" data-lote="${item.lote}" data-alerta="${item.alerta || ''}" ${isChecked ? 'checked' : ''}></td>
            <td>${item.item}</td>
            <td>${item.cod_catmas || '-'}</td>
            <td>${item.sku || '-'}</td>
            <td>${item.desc_catmas}</td>
            ${lote === 1 ? `<td>R$ ${formatarNumero(item.valor_un_mensal)}</td>` : ''}
            <td><input type="number" class="quantidade-input" data-id="${item.item}" value="${quantidade}" min="${qtdeMinima}" ${isChecked ? '' : 'disabled'}></td>
            ${lote === 1 ? `<td class="quantidade-total" data-id="${item.item}">${quantidadeTotal}</td>` : ''}
            <td class="valor-un-total" data-id="${item.item}">R$ ${formatarNumero(valorUnTotal)}</td>
            <td class="valor-total" data-id="${item.item}">R$ ${formatarNumero(valorTotal)}</td>`;
        tbody.appendChild(tr);
    });

    addEventListeners();
    updateSelectedItems();
}

function updateTableRow(id, quantidade, valorUnMensal, valorUnTotal, lote) {
    let valorTotal;

    if (lote == 1) {
        const quantidadeTotal = quantidade * 36;
        valorTotal = quantidade * (valorUnMensal * 36);
        document.querySelector(`.quantidade-total[data-id="${id}"]`).textContent = quantidadeTotal;
    } else {
        valorTotal = quantidade * valorUnTotal;
    }

    document.querySelector(`.valor-total[data-id="${id}"]`).textContent = `R$ ${formatarNumero(valorTotal)}`;
}

function updateSelectedItems() {
    const selectedList = document.getElementById('selectedList');
    selectedList.innerHTML = '';
    selectedItems.forEach((data, id) => {
        const valorTotal = data.lote == 1 
            ? data.quantidade_mensal * data.valor * 36 
            : data.quantidade_mensal * data.valor_total;
        selectedList.innerHTML += `
            <li>
                <strong>${id}:</strong> ${data.desc}<br>
                ${data.lote == 1 ? 'Qtde Mensal' : 'Quantidade'}: ${data.quantidade_mensal}<br>
                Valor total: R$ ${formatarNumero(valorTotal)}
            </li>`;
    });
}

function addEventListeners() {
    document.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.addEventListener('change', function () {
            const { id, desc, valor, valorTotal, min, lote, alerta } = this.dataset;
            const quantidadeInput = document.querySelector(`.quantidade-input[data-id="${id}"]`);
            const alertaDiv = document.getElementById('alerta-item');

            if (this.checked) {
                selectedItems.set(id, { 
                    desc, 
                    valor: parseFloat(valor), 
                    valor_total: parseFloat(valorTotal), 
                    quantidade_mensal: parseInt(min), 
                    lote 
                });
                quantidadeInput.disabled = false;
                quantidadeInput.value = min;
                alertaDiv.textContent = alerta && alerta.trim() !== "" ? alerta : "";
            } else {
                selectedItems.delete(id);
                quantidadeInput.disabled = true;
                quantidadeInput.value = 0;
                alertaDiv.textContent = "";
            }
            updateSelectedItems();
        });
    });

    document.querySelectorAll('.quantidade-input').forEach(input => {
        input.addEventListener('input', function () {
            const id = this.dataset.id;
            let quantidade = parseInt(this.value) || 0;
            const min = parseInt(this.min);
            if (quantidade < min) quantidade = min;
            this.value = quantidade;

            if (selectedItems.has(id)) {
                const item = selectedItems.get(id);
                item.quantidade_mensal = quantidade;
                updateTableRow(id, quantidade, item.valor, item.valor_total, item.lote);
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
            qtde_total: data.lote == 1 ? data.quantidade_mensal * 36 : data.quantidade_mensal,
            valor_un_total: data.lote == 1 ? data.valor * 36 : data.valor_total,
            valor_total: data.lote == 1 ? data.valor * data.quantidade_mensal * 36 : data.quantidade_mensal * data.valor_total
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