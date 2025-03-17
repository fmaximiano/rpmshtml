import { createClient } from "@supabase/supabase-js";

export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: "Erro: SUPABASE_URL ou SUPABASE_KEY não definidas no ambiente." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    if (req.method === "GET") {
        try {
            const { search = "", lote } = req.query;
            let query = supabase
                .from("licencas")
                .select("item, cod_catmas, sku, desc_catmas, valor_un_mensal, qtde_minima, lote, alerta"); // Incluído alerta aqui

            if (lote) query = query.eq("lote", lote);
            if (search) query = query.or(`desc_catmas.ilike.%${search}%,sku.ilike.%${search}%`);

            const { data, error } = await query;
            if (error) throw error;

            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } else if (req.method === "POST") {
        try {
            const { itens, nome, email, telefone, orgao } = req.body;

            if (!itens || !Array.isArray(itens) || itens.length === 0) {
                return res.status(400).json({ error: "Nenhum item recebido para salvar." });
            }
            if (!nome) return res.status(400).json({ error: "O campo 'nome' é obrigatório." });
            if (!email) return res.status(400).json({ error: "O campo 'email' é obrigatório." });
            if (!telefone) return res.status(400).json({ error: "O campo 'telefone' é obrigatório." });
            if (!orgao) return res.status(400).json({ error: "O campo 'orgao' é obrigatório." });

            const itemIds = itens.map(i => Number(i.item));
            const { data: itemsData, error: fetchError } = await supabase
                .from("licencas")
                .select("item, cod_catmas, sku, desc_catmas, valor_un_mensal, qtde_minima, lote, alerta")
                .in("item", itemIds);

            if (fetchError) throw fetchError;

            const itensCompletos = itens.map(it => {
                const itemBanco = itemsData.find(dbItem => dbItem.item === Number(it.item));
                if (!itemBanco) return null;

                return {
                    item: itemBanco.item,
                    cod_catmas: itemBanco.cod_catmas,
                    sku: itemBanco.sku,
                    desc_catmas: itemBanco.desc_catmas,
                    valor_un_mensal: itemBanco.valor_un_mensal,
                    qtde_minima: itemBanco.qtde_minima,
                    lote: itemBanco.lote,
                    alerta: itemBanco.alerta, // incluindo alerta para referência futura
                    quantidade_mensal: it.qtde_mensal,
                    qtde_total: it.qtde_total,
                    valor_un_total: it.valor_un_total,
                    valor_total: it.valor_total,
                    nome,
                    email,
                    telefone,
                    orgao
                };
            }).filter(it => it !== null);

            if (itensCompletos.length === 0) {
                return res.status(400).json({ error: "Nenhum item válido para salvar." });
            }

            const { data, error } = await supabase.from("selecionados").insert(itensCompletos);
            if (error) throw error;

            return res.status(200).json({ message: "Itens salvos com sucesso!", data });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } else {
        return res.status(405).json({ error: "Método não permitido" });
    }
}
