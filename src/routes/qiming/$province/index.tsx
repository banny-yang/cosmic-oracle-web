import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PlacePageView } from "@/components/qiming/place-page-view";
import { placeHead } from "@/lib/qiming/content";
import { fetchPlaceNameSamples } from "@/lib/qiming/name-samples";
import { loadProvince, toPlaceInfo } from "@/lib/qiming/places";

/** 省级地名页：/qiming/{省}（直辖市同页兼作城市页）。 */
export const Route = createFileRoute("/qiming/$province/")({
  component: ProvincePlacePage,
  loader: async ({ params }) => {
    const tree = await loadProvince(params.province);
    if (!tree) throw notFound();
    const place = toPlaceInfo(tree);
    const samples = await fetchPlaceNameSamples(place.adcode);
    return { place, ...samples };
  },
  head: ({ loaderData }) => placeHead(loaderData?.place),
});

function ProvincePlacePage() {
  const { place, male, female } = Route.useLoaderData();
  return (
    <AppShell>
      <PlacePageView place={place} male={male} female={female} />
    </AppShell>
  );
}
