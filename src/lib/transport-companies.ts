import { ObjectId, type Collection, type IndexDescription } from "mongodb";
import { getDb } from "@/lib/mongodb";

const TRANSPORT_COMPANIES_COLLECTION = "transportCompanies";

export type TransportCompanyServiceKey = "transport" | "unloading";

export type TransportCompanyLocation = {
  label: string;
  city?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lng: number;
};

export type TransportCompanyDocument = {
  _id: ObjectId;
  name: string;
  description: string;
  services: {
    transport: boolean;
    unloading: boolean;
  };
  terms: string;
  transportPrice: string;
  location: TransportCompanyLocation;
  phone: string;
  email: string;
  isActive: boolean;
  detailsViewCount?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TransportCompanyPublicItem = {
  id: string;
  name: string;
  description: string;
  services: TransportCompanyServiceKey[];
  terms: string;
  transportPrice: string;
  location: TransportCompanyLocation;
  phone: string;
  email: string;
  distanceKm: number | null;
  pickupDistanceKm: number | null;
  deliveryDistanceKm: number | null;
  totalRouteDistanceKm: number | null;
};

export type TransportCompanyAdminItem = TransportCompanyPublicItem & {
  isActive: boolean;
  detailsViewCount: number;
  createdAt: string;
  updatedAt: string;
};

let indexesEnsured = false;

export async function getTransportCompaniesCollection(): Promise<
  Collection<TransportCompanyDocument>
> {
  const db = await getDb();
  return db.collection<TransportCompanyDocument>(TRANSPORT_COMPANIES_COLLECTION);
}

export async function ensureTransportCompaniesIndexes(): Promise<void> {
  if (indexesEnsured) {
    return;
  }

  const collection = await getTransportCompaniesCollection();
  const indexes: IndexDescription[] = [
    { key: { isActive: 1, name: 1 }, name: "transport_companies_active_name" },
    { key: { "location.lat": 1, "location.lng": 1 }, name: "transport_companies_location" },
    { key: { detailsViewCount: -1 }, name: "transport_companies_details_views" },
    { key: { updatedAt: -1 }, name: "transport_companies_updated_at" },
  ];

  await collection.createIndexes(indexes);
  indexesEnsured = true;
}

export function calculateDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const earthRadiusKm = 6371;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function normalizeTransportCompanyServices(
  services: TransportCompanyDocument["services"],
): TransportCompanyServiceKey[] {
  const output: TransportCompanyServiceKey[] = [];
  if (services.transport) {
    output.push("transport");
  }
  if (services.unloading) {
    output.push("unloading");
  }
  return output;
}

export function mapTransportCompanyToPublicItem(
  company: TransportCompanyDocument,
  route?: {
    pickup?: { lat: number; lng: number } | null;
    delivery?: { lat: number; lng: number } | null;
  } | null,
): TransportCompanyPublicItem {
  const companyPoint = {
    lat: company.location.lat,
    lng: company.location.lng,
  };
  const pickupDistanceKm = route?.pickup
    ? calculateDistanceKm(companyPoint, route.pickup)
    : null;
  const deliveryDistanceKm = route?.delivery
    ? calculateDistanceKm(companyPoint, route.delivery)
    : null;
  const distanceKm = pickupDistanceKm ?? deliveryDistanceKm;
  const totalRouteDistanceKm =
    pickupDistanceKm !== null && deliveryDistanceKm !== null
      ? pickupDistanceKm + deliveryDistanceKm
      : distanceKm;

  return {
    id: company._id.toHexString(),
    name: company.name,
    description: company.description,
    services: normalizeTransportCompanyServices(company.services),
    terms: company.terms,
    transportPrice: company.transportPrice,
    location: company.location,
    phone: company.phone,
    email: company.email,
    distanceKm,
    pickupDistanceKm,
    deliveryDistanceKm,
    totalRouteDistanceKm,
  };
}

export function mapTransportCompanyToAdminItem(
  company: TransportCompanyDocument,
): TransportCompanyAdminItem {
  return {
    ...mapTransportCompanyToPublicItem(company, null),
    isActive: company.isActive,
    detailsViewCount:
      typeof company.detailsViewCount === "number" &&
      Number.isFinite(company.detailsViewCount)
        ? Math.max(0, Math.trunc(company.detailsViewCount))
        : 0,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}
