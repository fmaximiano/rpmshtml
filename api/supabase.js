import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {

    console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "Definida" : "Não definida");
    console.log("SUPABASE_KEY:", process.env.SUPABASE_KEY ? "Definida" : "Não definida");


    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: "Erro: SUPABASE_URL ou SUPABASE_KEY não definidas no ambiente." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { search = "", lote } = req.query; // Pega os query parameters

    let query = supabase
        .from("licencas")
        .select("item, cod_catmas, desc_catmas, sku, valor_un_mensal, qtde_minima, lote"); // Campos específicos

    if (lote) {
        query = query.eq("lote", lote); // Filtro por lote
    }

    if (search) {
        query = query.or(`desc_catmas.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    const { data, error } = await query;

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
}