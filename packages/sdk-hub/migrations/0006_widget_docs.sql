UPDATE widgets
SET status = 'stable',
    description = 'Barra + chat. Opt-in: nodo HTML y CONCIERGE (true / {} / partial). El Hub no enciende la barra en todo el sitio.',
    docs_path = 'docs/v2-agente.md#widget-concierge'
WHERE id = 'concierge';

UPDATE widgets SET docs_path = 'docs/v2-agente.md#widget-calendario' WHERE id = 'meetings-calendar';
UPDATE widgets SET docs_path = 'docs/v2-agente.md#widget-catalogo' WHERE id IN ('combo-list', 'membership-list', 'staff-list', 'service-list');
UPDATE widgets SET docs_path = 'docs/v2-agente.md#widget-auth' WHERE id IN ('login', 'register', 'password-recovery', 'login-register', 'login-register-pages');
UPDATE widgets SET docs_path = 'docs/v2-agente.md#widget-perfil' WHERE id = 'profile-info';
UPDATE widgets SET docs_path = 'docs/v2-agente.md#widget-compra' WHERE id IN ('purchase-button', 'fancy');
