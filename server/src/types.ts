export type Role = "CENTRAL_ADMIN" | "RU_MANAGER" | "RU_AGENT";
export type RestaurantUserRole = "MANAGER" | "AGENT";
export type ServiceKind = "MIDI" | "SOIR";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type ReservationStatus =
  | "PENDING_PAYMENT"
  | "RESERVED"
  | "CODE_USED"
  | "TOKEN_ISSUED"
  | "SERVED"
  | "CANCELLED"
  | "EXPIRED";

export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  restaurantId: number | null;
  restaurantName: string | null;
  restaurantCode: string | null;
  cityName: string | null;
};

export type MenuItem = {
  position: number;
  dishId: number;
  dishName: string;
  priceFcfa: number;
};

export type UssdResponse = {
  sessionId: string;
  message: string;
  continueSession: boolean;
  step: string;
};
