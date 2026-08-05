import type { GafaClient, Meeting, UserProfile } from "./types";
import type { GafaSdkConfig } from "../config";

export function createGafaClient(_options: GafaSdkConfig): GafaClient {
  return createMockGafaClient();
}

export function createMockGafaClient(): GafaClient {
  return {
    listBrands: async () => [
      {
        id: 1,
        name: "Demo Studio",
        slug: "demo-studio",
      },
    ],
    listLocations: async () => [
      {
        id: 1,
        name: "Roma Norte",
        slug: "roma-norte",
        brandSlug: "demo-studio",
      },
      {
        id: 2,
        name: "Condesa",
        slug: "condesa",
        brandSlug: "demo-studio",
      },
    ],
    listStaff: async () => [
      {
        id: 1,
        name: "Coach Demo",
        lastname: "Rivera",
        bio: "Entrenador principal",
        slug: "coach-demo",
      },
      {
        id: 2,
        name: "Coach Ana",
        lastname: "Lopez",
        slug: "coach-ana",
      },
    ],
    listServices: async () => [
      {
        id: 1,
        name: "Functional Training",
        durationMinutes: 50,
      },
      {
        id: 2,
        name: "Yoga Flow",
        durationMinutes: 45,
      },
    ],
    listCombos: async () => [
      {
        id: 1,
        name: "10 clases",
        description: "Paquete inicial para reservar en cualquier sede.",
        priceLabel: "$1,200 MXN",
        currency: "MXN",
      },
    ],
    listMemberships: async () => [
      {
        id: 2,
        name: "Mensual ilimitada",
        description: "Membresia para clientes recurrentes.",
        priceLabel: "$2,400 MXN",
        currency: "MXN",
      },
    ],
    listMeetings: async () => demoMeetings(),
    getProfile: async (): Promise<UserProfile | null> => ({
      id: 1,
      name: "Usuario Demo",
      email: "demo@gafa.fit",
      creditsLabel: "5 creditos disponibles",
    }),
    login: async () => ({ access_token: "demo-token" }),
    logout: () => undefined,
    register: async () => ({ url: undefined }),
    requestPasswordReset: async () => undefined,
    resetPassword: async () => undefined,
    openCheckout: async () => undefined,
    openReservationCheckout: async () => undefined,
  };
}

function demoMeetings(): Meeting[] {
  const now = new Date();
  const first = new Date(now);
  first.setHours(8, 0, 0, 0);

  const second = new Date(now);
  second.setHours(18, 30, 0, 0);

  return [
    {
      id: 1,
      name: "Functional Training",
      startsAt: first.toISOString(),
      durationMinutes: 50,
      staffName: "Coach Demo",
      serviceName: "Training",
      availability: "available",
      available: 8,
      capacity: 18,
      isReserved: false,
      location: {
        id: 1,
        name: "Roma Norte",
        slug: "roma-norte",
      },
    },
    {
      id: 2,
      name: "Mobility Flow",
      startsAt: second.toISOString(),
      durationMinutes: 45,
      staffName: "Coach Ana",
      serviceName: "Wellness",
      availability: "waitlist",
      available: 0,
      capacity: 14,
      isReserved: false,
      location: {
        id: 2,
        name: "Condesa",
        slug: "condesa",
      },
    },
  ];
}
