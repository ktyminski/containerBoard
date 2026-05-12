import {
  ensureTransportCompaniesIndexes,
  getTransportCompaniesCollection,
  mapTransportCompanyToPublicItem,
  type TransportCompanyPublicItem,
} from "@/lib/transport-companies";

function roundDistance(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null;
}

export async function getPublicTransportCompanies(input?: {
  location?: { lat: number; lng: number } | null;
  limit?: number;
}): Promise<TransportCompanyPublicItem[]> {
  await ensureTransportCompaniesIndexes();
  const collection = await getTransportCompaniesCollection();
  const companies = await collection
    .find({
      isActive: true,
      $or: [
        { "services.transport": true },
        { "services.unloading": true },
      ],
    })
    .sort({ name: 1 })
    .limit(input?.limit ?? 500)
    .toArray();

  return companies
    .map((company) =>
      mapTransportCompanyToPublicItem(
        company,
        input?.location ? { pickup: input.location, delivery: null } : null,
      ),
    )
    .sort((left, right) => {
      if (!input?.location) {
        return left.name.localeCompare(right.name);
      }
      const leftDistance = left.pickupDistanceKm ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.pickupDistanceKm ?? Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance;
    })
    .map((item) => ({
      ...item,
      distanceKm: roundDistance(item.distanceKm),
      pickupDistanceKm: roundDistance(item.pickupDistanceKm),
      deliveryDistanceKm: roundDistance(item.deliveryDistanceKm),
      totalRouteDistanceKm: roundDistance(item.totalRouteDistanceKm),
    }));
}
