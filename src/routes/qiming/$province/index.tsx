import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PlacePageView } from "@/components/qiming/place-page-view";
import { placeHead } from "@/lib/qiming/content";
import { fetchPlaceNameSamples } from "@/lib/qiming/name-samples";
import { loadProvince, toPlaceInfo } from "@/lib/qiming/places";
import { getPlaceRolloutStage } from "@/lib/qiming/rollout-runtime";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";

/** 省级地名页：/qiming/{省}（直辖市同页兼作城市页）。 */
export const Route = createFileRoute("/qiming/$province/")({
  component: ProvincePlacePage,
  loader: async ({ params }) => {
    const tree = await loadProvince(params.province);
    if (!tree) throw notFound();
    const place = toPlaceInfo(tree);
    const [samples, stage, stages] = await Promise.all([
      fetchPlaceNameSamples(place.adcode),
      getPlaceRolloutStage(),
      getLongtailStages(),
    ]);
    return { place, ...samples, stage, stages };
  },
  head: ({ loaderData }) => placeHead(loaderData?.place, loaderData?.stage),
});

function ProvincePlacePage() {
  const { place, male, female, stages } = Route.useLoaderData();
  return (
    <AppShell>
      <PlacePageView
        place={place}
        male={male}
        female={female}
        surnamePlaceStage={stages?.surnamePlace ?? 0}
      />
    </AppShell>
  );
}
