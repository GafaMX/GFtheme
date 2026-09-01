import type { GafaClient } from "../client/types";
import type { SdkTracker } from "./tracker";

export function instrumentClient(client: GafaClient, tracker: SdkTracker): GafaClient {
  const next: GafaClient = {
    ...client,
    async login(credentials) {
      try {
        const result = await client.login(credentials);
        let userId: number | null = null;
        try {
          const profile = await client.getProfile();
          userId = profile?.id ?? null;
          tracker.setUser({ id: userId, name: profile?.name ?? null, email: profile?.email ?? null });
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
        const profile = await client.getProfile();
        userId = profile?.id ?? null;
        tracker.setUser({ id: userId, name: profile?.name ?? null, email: profile?.email ?? null });
      } catch {
        userId = null;
        tracker.setUserId(null);
      }
      tracker.track({ event: "auth.registered", widget: "auth", user_id: userId });
      return result;
    },
    async cancelReservation(brandSlug, reservationId) {
      await client.cancelReservation(brandSlug, reservationId);
      tracker.track({
        event: "reservation.cancelled",
        widget: "profile",
        props: { reservation_id: reservationId },
      });
    },
  };

  if (client.createReservation) {
    const createReservation = client.createReservation.bind(client);
    next.createReservation = async (payload) => {
      const result = await createReservation(payload);
      tracker.track({
        event: result.isWaitlist ? "reservation.waitlisted" : "reservation.confirmed",
        widget: "calendar",
        user_id: payload.userProfileId,
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
      if (result.reservationId) {
        tracker.track({
          event: "checkout.paid",
          widget: "checkout",
          props: {
            reservation_id: result.reservationId,
            purchase_id: payload.pendingPurchaseId,
          },
        });
      } else if (result.message && result.code !== 0) {
        tracker.track({ event: "checkout.failed", widget: "checkout", props: { message: result.message } });
      }
      return result;
    };
  }

  return next;
}
