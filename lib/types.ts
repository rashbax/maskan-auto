// Domain types — the shape the UI consumes (mirrors the mock data in maskan/data.js).
// Real Supabase rows are mapped into these in the data-access layer.

export type Lang = "uz" | "ru" | "en";
export type I18n = Record<Lang, string>;

export interface Apartment {
  id: string;
  tone: string;
  price: number; // USD/night
  district: string;
  sleeps: number;
  beds: number;
  baths: number;
  size: number; // m²
  rating: number;
  reviews: number;
  photos: number;
  host: string;
  superhost: boolean;
  near: I18n;
  title: I18n;
  blurb: I18n;
  amenities: string[];
  lat?: number;
  lng?: number;
  busy: Set<string>; // ISO dates that are taken (bookings + manual blocks)
  reviewsList: Review[];
}

export interface Review {
  name: string;
  country: string;
  rating: number;
  date: string; // ISO
  cons: string;
  text: string;
  hostReply?: string;
  hidden?: boolean;
}

export interface Booking {
  id: string;
  apt: string;
  guest?: string;
  phone?: string;
  tg?: string;
  from: string;
  to: string;
  nights: number;
  total?: number;
  usd?: number;
  source?: "website" | "booking" | "manual";
  status: "active" | "past" | "cancelled" | "checked-out";
}

export interface Profile {
  id: string;
  name: string;
  phone?: string;
  telegram?: string;
  lang: Lang;
  role: "guest" | "admin";
}
