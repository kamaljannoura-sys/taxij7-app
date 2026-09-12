export type Role = "DISPATCHER" | "DRIVER";
export type DriverStatus = "AVAILABLE" | "UNAVAILABLE" | "ON_RIDE";
export type RideStatus =
  | "PENDING"
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED";
export type VehicleType = "STANDARD" | "VAN" | "PREMIUM";

export interface DriverProfile {
  id: string;
  userId: string;
  status: DriverStatus;
  vehicle: string | null;
  plate: string | null;
  lat: number | null;
  lng: number | null;
}

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  driverProfile: DriverProfile | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  driverProfile: DriverProfile | null;
  completedRides: number;
}

export interface Ride {
  id: string;
  clientName: string;
  clientPhone: string;
  pickupAddress: string;
  destinationAddress: string;
  notes: string | null;
  status: RideStatus;
  vehicleType: VehicleType;
  estimatedPrice: number | null;
  driverId: string | null;
  driver: { id: string; name: string; phone: string } | null;
  dispatcher: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}
