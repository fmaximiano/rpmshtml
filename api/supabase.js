import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export const config = {
    api: {
        bodyParser: true,
    },
};

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_PASS = process.env.GMAIL_PASS;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: "Erro: SUPABASE_URL ou SUPABASE_KEY não definidas no ambiente." });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    if (req.method === "GET") {
        try {
            const { search = "", lote } = req.query;
            let query = supabase
                .from("licencas")
                .select("item, cod_catmas, sku, desc_catmas, valor_un_mensal, valor_un_total, qtde_minima, lote, alerta");

            if (lote) query = query.eq("lote", lote);
            if (search) query = query.or(`desc_catmas.ilike.%${search}%,sku.ilike.%${search}%`);

            const { data, error } = await query;
            if (error) throw error;

            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } 
    else if (req.method === "POST") {
        try {
            const { itens, nome, email, telefone, orgao } = req.body;

            if (!itens || !Array.isArray(itens) || itens.length === 0) {
                return res.status(400).json({ error: "Nenhum item recebido para salvar." });
            }
            if (!nome || !email || !telefone || !orgao) {
                return res.status(400).json({ error: "Todos os campos do formulário são obrigatórios." });
            }

            // Busca informações dos itens no Supabase
            const itemIds = itens.map(i => Number(i.item));
            const { data: itemsData, error: fetchError } = await supabase
                .from("licencas")
                .select("item, cod_catmas, desc_catmas, valor_un_mensal, valor_un_total, lote")
                .in("item", itemIds);

            if (fetchError) throw fetchError;

            const itensCompletos = itens.map(it => {
                const itemBanco = itemsData.find(dbItem => dbItem.item === Number(it.item));
                if (!itemBanco) return null;
            
                return {
                    item: itemBanco.item,
                    cod_catmas: itemBanco.cod_catmas,
                    desc_catmas: itemBanco.desc_catmas,
                    lote: itemBanco.lote,
                    qtde_mensal: it.qtde_mensal,
                    qtde_total: it.qtde_total,
                    valor_un_mensal: it.valor_un_mensal,
                    valor_un_total: it.valor_un_total,
                    valor_total: it.valor_total,
                    lote: it.lote,
                    qtde_minima: it.qtde_minima,
                    nome,
                    email,
                    telefone,
                    orgao
                };
            }).filter(it => it !== null);

            if (itensCompletos.length === 0) {
                return res.status(400).json({ error: "Nenhum item válido para salvar." });
            }

            // Salvar no Supabase
            const { error } = await supabase.from("selecionados").insert(itensCompletos);
            if (error) throw error;

            // ** Monta o conteúdo da tabela para o e-mail **
            let tabelaHTML = `
                <h3>Itens Selecionados</h3>
                <table border="1" cellspacing="0" cellpadding="5">
                    <thead>
                        <tr>
                            <th>Código CATMAS</th>
                            <th>Descrição CATMAS</th>
                            <th>Quantidade</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            itensCompletos.forEach(item => {
                tabelaHTML += `
                    <tr>
                        <td>${item.cod_catmas}</td>
                        <td>${item.desc_catmas}</td>
                        <td>${item.qtde_total}</td>
                    </tr>
                `;
            });

            tabelaHTML += `</tbody></table>`;

            // ** Configuração do e-mail **
            let transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: GMAIL_USER,
                    pass: GMAIL_PASS,
                },
            });

            const mailOptions = {
                from: `"Sistema de Seleção de Itens" <${GMAIL_USER}>`,
                to: `${email}, fmaximiano@outlook.com`,
                subject: "Confirmação de Seleção de Itens",
                html: `
                    <p>Olá, ${nome},</p>
                    <p>Segue abaixo a lista de itens selecionados para o órgão ${orgao}.</p>
                    ${tabelaHTML}
                    <p>Se precisar de ajustes, entre em contato.</p>
                    <p>Atenciosamente,<br>Sistema de Seleção de Itens</p>
                `,
            };

            await transporter.sendMail(mailOptions);

            return res.status(200).json({ message: "Itens salvos e e-mail enviado com sucesso!" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    } 
    else {
        return res.status(405).json({ error: "Método não permitido" });
    }
}
