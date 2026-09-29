import { readStoredToken } from "../client/tokenStorage";
import type { GafaClient, UserProfile } from "../client/types";
import type { HubUser, SdkTracker } from "./tracker";

function applyProfile(tracker: SdkTracker, profile: UserProfile | null | undefined): HubUser {
  if (profile?.id == null || profile.id <= 0) return tracker.getUser();
  tracker.setUser({
    id: profile.id,
    name: profile.name ?? null,
    email: profile.email ?? null,
  });
  return tracker.getUser();
}

async function syncProfile(client: GafaClient, tracker: SdkTracker): Promise<HubUser> {
  const current = tracker.getUser();
  if ((current.name && current.name.trim()) || (current.email && current.email.trim())) {
    return current;
  }
  try {
    return applyProfile(tracker, await client.getProfile());
  } catch {
    return tracker.getUser();
  }
}

export function instrumentClient(client: GafaClient, tracker: SdkTracker): GafaClient {
  const getProfile = client.getProfile.bind(client);

  const next: GafaClient = {
    ...client,
    async getProfile() {
      const profile = await getProfile();
      applyProfile(tracker, profile);
      return profile;
    },
    async login(credentials) {
      try {
        const result = await client.login(credentials);
        let userId: number | null = null;
        try {
          const profile = await getProfile();
          applyProfile(tracker, profile);
          userId = profile?.id ?? null;
        } catch {
          userId = null;
          tracker.setUserId(null);
        }
        tracker.track({ event: "auth.login_succeeded", widget: "auth", user_id: userId });
        return result;
      } catch (error) {
        tracker.track({ event: "auth.login_failed", widget: "auth" });
        throw error;
      }
    },
    logout() {
      client.logout();
      tracker.track({ event: "auth.logged_out", widget: "auth" });
      tracker.setUserId(null);
    },
    async register(payload) {
      const result = await client.register(payload);
      let userId: number | null = null;
      try {
        const profile = await getProfile();
        applyProfile(tracker, profile);
        userId = profile?.id ?? null;
      } catch {
        userId = null;
        tracker.setUserId(null);
      }
      tracker.track({ event: "auth.registered", widget: "auth", user_id: userId });
      return result;
    },
    async cancelReservation(brandSlug, reservationId) {
      await client.cancelReservation(brandSlug, reservationId);
      await syncProfile(client, tracker);
      tracker.track({
        event: "reservation.cancelled",
        widget: "profile",
        props: { reservation_id: reservationId },
      });
    },
  };

  if (readStoredToken()) {
    void getProfile()
      .then((profile) => applyProfile(tracker, profile))
      .catch(() => undefined);
  }

  if (client.createReservation) {
    const createReservation = client.createReservation.bind(client);
    next.createReservation = async (payload) => {
      const result = await createReservation(payload);
      const user = await syncProfile(client, tracker);
      tracker.track({
        event: result.isWaitlist ? "reservation.waitlisted" : "reservation.confirmed",
        widget: "calendar",
        user_id: user.id ?? payload.userProfileId,
        props: { meeting_id: payload.meetingId, reservation_id: result.reservationId },
      });
      return result;
    };
  }

  if (client.initialPurchase) {
    const initialPurchase = client.initialPurchase.bind(client);
    next.initialPurchase = async (payload) => {
      try {
        return await initialPurchase(payload);
      } catch (error) {
        tracker.track({ event: "checkout.failed", widget: "checkout" });
        throw error;
      }
    };
  }

  if (client.pollInitialPurchaseStatus) {
    const poll = client.pollInitialPurchaseStatus.bind(client);
    next.pollInitialPurchaseStatus = async (payload) => {
      const result = await poll(payload);
      if (result.code === 1) {
        await syncProfile(client, tracker);
        tracker.track({
          event: "checkout.paid",
          widget: "checkout",
          props: {
            reservation_id: result.reservationId,
            purchase_id: payload.pendingPurchaseId,
          },
        });
      } else if (result.code === -1 || (result.message && result.code !== 0)) {
        tracker.track({ event: "checkout.failed", widget: "checkout", props: { message: result.message } });
      }
      return result;
    };
  }

  return next;
}
