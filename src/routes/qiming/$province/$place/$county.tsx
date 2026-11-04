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
 * 县级地名页：/qiming/{省}/{市}/{县}；直辖市的区为 /qiming/{省}/{区}（走上一级路由）。
 *
 * 父级或县名写错时，先看本省有没有同名节点的规范地址（301），否则 404。
 */
export const Route = createFileRoute("/qiming/$province/$place/$county")({
  component: CountyPlacePage,
  loader: async ({ params }) => {
    const tree = await loadProvince(params.province);
    if (!tree) throw notFound();

    const parent = findProvinceChild(tree, params.place);
    const node = parent?.children?.find((child) => child.slug === params.county);
    if (!node) {
      const elsewhere = findPlaceAnywhere(tree, params.county);
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

function CountyPlacePage() {
  const { place, male, female } = Route.useLoaderData();
  return (
    <AppShell>
      <PlacePageView place={place} male={male} female={female} />
    </AppShell>
  );
}
