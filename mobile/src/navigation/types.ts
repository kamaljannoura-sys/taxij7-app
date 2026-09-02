import type { Ride } from "../types";

export type DriverStackParamList = {
  DriverHome: undefined;
  RideDetail: { rideId: string; ride?: Ride };
};

export type DispatcherTabParamList = {
  Drivers: undefined;
  Map: undefined;
  NewRide: undefined;
  History: undefined;
};
