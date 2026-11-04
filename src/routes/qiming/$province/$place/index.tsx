import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PlacePageView } from "@/components/qiming/place-page-view";
import { placeHead } from "@/lib/qiming/content";
import { fetchPlaceNameSamples } from "@/lib/qiming/name-samples";
import {
  findPlaceAnywhere,
  findProvinceChild,
  loadProvince,
  toPlaceInfo,
} from "@/lib/qiming/places";
import { getPlaceRolloutStage } from "@/lib/qiming/rollout-runtime";

/**
 * 地级/省直管县级地名页：/qiming/{省}/{市}。
 *
 * 层级写错的地址（如把县直接挂在省下）301 到规范地址；本省找不到才 404，
 * 不跨省猜——跨省会多加载一棵树，收益只是纠一个错误链接。
 */
export const Route = createFileRoute("/qiming/$province/$place/")({
  component: PlacePage,
  loader: async ({ params }) => {
    const tree = await loadProvince(params.province);
    if (!tree) throw notFound();

    const node = findProvinceChild(tree, params.place);
    if (!node) {
      const elsewhere = findPlaceAnywhere(tree, params.place);
      if (elsewhere) throw redirect({ href: elsewhere.path, statusCode: 301 });
      throw notFound();
    }

    const place = toPlaceInfo(node);
    const [samples, stage] = await Promise.all([
      fetchPlaceNameSamples(place.adcode),
      getPlaceRolloutStage(),
    ]);
    return { place, ...samples, stage };
  },
  head: ({ loaderData }) => placeHead(loaderData?.place, loaderData?.stage),
});

function PlacePage() {
  const { place, male, female } = Route.useLoaderData();
  return (
    <AppShell>
      <PlacePageView place={place} male={male} female={female} />
    </AppShell>
  );
}
