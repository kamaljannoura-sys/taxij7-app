import { API_BASE_URL } from "./config";
import type { AuthUser, Driver, DriverStatus, Ride, RideStatus } from "../types";

class ApiError extends Error {}

async function request<T>(
  path: string,
  options: { method?: string; token?: string | null; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? "Une erreur est survenue");
  }
  return data as T;
}

export const api = {
  login: (phone: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { phone, password },
    }),

  updateMe: (token: string, body: { name?: string; password?: string }) =>
    request<{ token: string; user: AuthUser }>("/auth/me", { method: "PATCH", token, body }),

  getDrivers: (token: string) => request<Driver[]>("/drivers", { token }),

  createDriver: (
    token: string,
    body: { name: string; phone: string; password: string; vehicle?: string; plate?: string }
  ) => request<Driver>("/drivers", { method: "POST", token, body }),

  updateMyStatus: (token: string, status: DriverStatus) =>
    request("/drivers/me/status", { method: "PATCH", token, body: { status } }),

  getDispatcherContact: (token: string) =>
    request<{ name: string; phone: string }>("/drivers/dispatcher-contact", { token }),

  getRides: (token: string) => request<Ride[]>("/rides", { token }),

  getMyRides: (token: string) => request<Ride[]>("/rides/mine", { token }),

  createRide: (
    token: string,
    body: {
      clientName: string;
      clientPhone: string;
      pickupAddress: string;
      destinationAddress: string;
      notes?: string;
      driverId?: string;
    }
  ) => request<Ride>("/rides", { method: "POST", token, body }),

  assignRide: (token: string, rideId: string, driverId: string) =>
    request<Ride>(`/rides/${rideId}/assign`, { method: "PATCH", token, body: { driverId } }),

  acceptRide: (token: string, rideId: string) =>
    request<Ride>(`/rides/${rideId}/accept`, { method: "PATCH", token }),

  declineRide: (token: string, rideId: string) =>
    request<Ride>(`/rides/${rideId}/decline`, { method: "PATCH", token }),

  updateRideStatus: (token: string, rideId: string, status: RideStatus) =>
    request<Ride>(`/rides/${rideId}/status`, { method: "PATCH", token, body: { status } }),

  unlockDoor: (token: string) =>
    request<{ success: boolean; message: string }>("/drivers/me/unlock-door", {
      method: "POST",
      token,
    }),

  boostBattery: (token: string) =>
    request<{ success: boolean; message: string }>("/drivers/me/boost-battery", {
      method: "POST",
      token,
    }),
};
