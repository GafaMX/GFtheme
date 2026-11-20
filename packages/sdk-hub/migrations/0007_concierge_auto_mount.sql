-- El Concierge ya no pide nodo HTML: la config del Hub lo monta en todo el sitio.
UPDATE widgets
SET description = 'Barra + chat. Se enciende con CONCIERGE (true / {} / partial) desde el Hub o el HTML: si la pagina no pone el nodo, el SDK cuelga el suyo del body. data-gf-concierge="off" excluye una pagina.'
WHERE id = 'concierge';
