/**
 * Forma del contrato público de Buq Next (F0 / ADR-017 previsto).
 * Los ids nativos son uuid; el GafaClient sigue hablando en enteros.
 *
 * En F0' esto solo vive en fixtures locales. F1 pegará a
 * `GET /api/publico/v1/sedes/{sedeId}/{catalogo,clases,ofertas}`.
 */

export type BuqNextVentaTipo = "paquete" | "membresia" | "producto";

/** Línea que Ventas espera en `cotizarVenta` / `crearVenta` (`lineaSolicitudVenta`). */
export type LineaSolicitudVenta = {
  tipo: BuqNextVentaTipo;
  ofertaId: string;
  cantidad: number;
};

export type BuqNextOrganizacion = {
  id: string;
  numericId: number;
  nombre: string;
  slug: string;
};

export type BuqNextMarca = {
  id: string;
  numericId: number;
  nombre: string;
  slug: string;
  logoUrl?: string;
  zonaHoraria: string;
  moneda: "MXN";
};

export type BuqNextSede = {
  id: string;
  numericId: number;
  nombre: string;
  slug: string;
  marcaId: string;
  diasCalendario: number;
};

export type BuqNextServicio = {
  id: string;
  numericId: number;
  nombre: string;
  descripcion?: string;
  duracionMinutos: number;
};

export type BuqNextCoach = {
  id: string;
  numericId: number;
  nombre: string;
  apellido?: string;
  apodo?: string;
  bio?: string;
  fotoUrl?: string;
};

export type BuqNextSalon = {
  id: string;
  numericId: number;
  nombre: string;
  capacidad: number;
  tieneMapa: boolean;
};

export type BuqNextClase = {
  id: string;
  numericId: number;
  sedeId: string;
  servicioId: string;
  coachId: string;
  salonId: string;
  /** Offset en días desde hoy (el preview regenera `iniciaEl` al cargar). */
  diasDesdeHoy: number;
  hora: string;
  zonaHoraria: string;
  cupo: number;
  reservados: number;
  listaEspera: boolean;
  nota?: string;
};

export type BuqNextOferta = {
  id: string;
  numericId: number;
  tipo: BuqNextVentaTipo;
  nombre: string;
  descripcion?: string;
  precioCentavos: number;
  moneda: "MXN";
  creditos?: number;
  vigenciaDias?: number;
  suscribible?: boolean;
};

/** Snapshot de lectura pública por sede (calendario + catálogo + coaches + salones). */
export type BuqNextCatalogoSede = {
  organizacion: BuqNextOrganizacion;
  marca: BuqNextMarca;
  sede: BuqNextSede;
  servicios: BuqNextServicio[];
  coaches: BuqNextCoach[];
  salones: BuqNextSalon[];
  clases: BuqNextClase[];
  ofertas: BuqNextOferta[];
};
