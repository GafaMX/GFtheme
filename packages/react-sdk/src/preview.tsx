import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, ColorSchemeToggle } from "./sdk/theme/theme";
import { AccountModal } from "./sdk/widgets/AccountModal";
import type { GafaClient } from "./sdk/client/types";
import "./sdk/theme/theme.css";
import "./sdk/widgets/widgets.css";
import "./demo/demo.css";

const inDays = (days: number, hour = 7) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, days % 2 ? 5 : 0, 0, 0);
  return date.toISOString();
};

const isEmptyMode = new URLSearchParams(window.location.search).get("empty") === "1";

const client = {
  getProfile: async () => ({
    id: 1,
    name: "Gabriel Arrechea",
    email: "gabriel+fitspin@buq.mx",
    firstName: "Gabriel",
    lastName: "Arrechea",
    storeCreditTotal: isEmptyMode ? "0" : "350",
    memberSince: inDays(-370),
    phone: "5511223344",
    customFields: { 47: { 21272: "5522334455" } },
  }),
  listBrands: async () => [{ id: 1, name: "Fitspin", slug: "fitspin" }],
  listRegistrationFields: async () => [
    {
      id: 47,
      name: "Información adicional",
      description: "Lo que la marca pide además de los datos de siempre.",
      fields: [
        { id: 21272, name: "Teléfono de emergencia", type: "number", required: true, options: [] },
        {
          id: 21273,
          name: "¿Cómo nos conociste?",
          type: "text",
          required: false,
          helpText: "Nos ayuda a saber dónde invertir.",
          options: [
            { id: 1, name: "Instagram" },
            { id: 2, name: "Un amigo" },
            { id: 3, name: "Pasé por el estudio" },
          ],
        },
      ],
    },
  ],
  listUserCredits: async () =>
    isEmptyMode
      ? []
      : [
          { id: 1, name: "Paquete 10 clases", total: 5, expiresAt: inDays(60) },
          { id: 2, name: "Clase suelta", total: 1, expiresAt: inDays(12) },
        ],
  listUserMemberships: async () => (isEmptyMode ? [] : [{ id: 9, name: "Ilimitada mensual", expiresAt: inDays(18) }]),
  listUserReservations: async (_slug: string, scope: string) => {
    if (isEmptyMode) return [];
    return scope === "future"
      ? [
          {
            id: 1,
            serviceName: "Bici PM",
            startsAt: inDays(0, 20),
            locationName: "Lomas",
            staffName: "ISA",
            brandSlug: "fitspin",
            isWaitlist: false,
            isOverbooking: false,
            creditId: 1,
            creditTypeName: "CDMXnew",
            seatLabel: "21",
            qrHash: "demo-hash-1",
            canCancel: true,
          },
          {
            id: 2,
            serviceName: "Fuerza",
            startsAt: inDays(3, 6),
            locationName: "Cancún",
            staffName: "RAD REGINA ALBOR",
            brandSlug: "fitspin",
            isWaitlist: false,
            isOverbooking: true,
            creditId: null,
            creditTypeName: null,
            seatLabel: "22",
            qrHash: "demo-hash-2",
            canCancel: true,
          },
          {
            id: 3,
            serviceName: "Sculpt",
            startsAt: inDays(5, 8),
            locationName: "Lomas",
            staffName: "NAT",
            brandSlug: "fitspin",
            isWaitlist: true,
            isOverbooking: false,
            waitlistPosition: "2",
            canCancel: true,
          },
          {
            id: 4,
            serviceName: "Bici AM",
            startsAt: inDays(6, 6),
            locationName: "Lomas",
            staffName: "Pollo",
            brandSlug: "fitspin",
            isWaitlist: false,
            isOverbooking: false,
            cancelled: true,
          },
        ]
      : [
          {
            id: 11,
            serviceName: "Bici AM",
            startsAt: inDays(-2, 6),
            locationName: "Lomas",
            staffName: "Pau J",
            brandSlug: "fitspin",
            isWaitlist: false,
            isOverbooking: false,
            creditId: 2,
            creditTypeName: "CDMXnew",
          },
          {
            id: 12,
            serviceName: "Fuerza",
            startsAt: inDays(-6, 7),
            locationName: "Lomas",
            staffName: "ISA",
            brandSlug: "fitspin",
            isWaitlist: false,
            isOverbooking: false,
          },
        ];
  },
  listUserPurchases: async () =>
    isEmptyMode
      ? []
      : [
          {
            id: 1,
            name: "Paquete 10 clases",
            total: 2400,
            currencyPrefix: "$",
            createdAt: inDays(-20),
            status: "Pagada",
            paymentType: "Tarjeta",
            locationName: "Lomas",
          },
          {
            id: 2,
            name: "Ilimitada mensual",
            total: 1899,
            currencyPrefix: "$",
            createdAt: inDays(-52),
            status: "Pagada",
            paymentType: "Tarjeta",
          },
        ],
  getUserActivityTotals: async () =>
    isEmptyMode
      ? {
          reservedCount: 0,
          attendedCount: 0,
          noShowCount: 0,
          cancelledCount: 0,
          attendedMinutes: 0,
          favoriteStaff: [],
          favoriteSchedules: [],
        }
      : {
          reservedCount: 42,
          attendedCount: 38,
          noShowCount: 2,
          cancelledCount: 4,
          attendedMinutes: 1710,
          favoriteStaff: ["ISA", "Pau J"],
          favoriteSchedules: ["6:00 a.m.", "8:15 p.m."],
        },
  cancelReservation: async () => undefined,
  cancelWaitlist: async () => undefined,
  updateProfile: async () => ({ id: 1, name: "Gabriel Arrechea", email: "gabriel+fitspin@buq.mx" }),
  logout: async () => undefined,
} as unknown as GafaClient;

function Preview() {
  const params = new URLSearchParams(window.location.search);
  const [open, setOpen] = useState(params.get("closed") !== "1");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0 } } });

  return (
    <ThemeProvider
      theme={{
        colors: { brand: "#f2b705", accent: "#111827" },
        colorScheme: params.get("dark") === "1" ? "dark" : "light",
      }}
    >
      <QueryClientProvider client={queryClient}>
        <div className="demo-root">
          <header className="demo-header">
            <div className="demo-header__inner">
              <span className="demo-logo">Fitspin</span>
              <ColorSchemeToggle />
              <button className="demo-account" type="button" onClick={() => setOpen(true)}>
                Mi cuenta
              </button>
            </div>
          </header>
          <main className="demo-main" style={{ minHeight: "70vh" }} />
          <AccountModal
            client={client}
            open={open}
            onClose={() => setOpen(false)}
            title="Fitspin"
            onExploreClasses={() => window.alert("Ir al calendario (demo)")}
            onExplorePackages={() => window.alert("Ir a paquetes (demo)")}
          />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("app")!).render(<Preview />);
