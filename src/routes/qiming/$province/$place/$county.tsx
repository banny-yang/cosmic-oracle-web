import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PlacePageView } from "@/components/qiming/place-page-view";
import { PlaceSurnamePage } from "@/components/qiming/place-surname-page";
import { placeHead } from "@/lib/qiming/content";
import { fetchPlaceNameSamples } from "@/lib/qiming/name-samples";
import {
  findPlaceAnywhere,
  findProvinceChild,
  loadProvince,
  toPlaceInfo,
} from "@/lib/qiming/places";
import { getPlaceRolloutStage } from "@/lib/qiming/rollout-runtime";
import { fetchGalleryPair, fetchSurnameNoteView } from "@/lib/seo/data";
import { getLongtailStages } from "@/lib/seo/rollout-runtime";
import { placeSurnameHead } from "@/lib/seo/place-surname";
import { surnameByPinyin } from "@/lib/surnames";

/**
 * 县级地名页 / 城市×姓氏页：/qiming/{省}/{市}/{第三段}。
 *
 * 第三段三种去向，按序判定：
 * 1. 父城市下辖的县（slug 命中）→ 县级地名页（原有行为优先，撞车的姓氏拼音让路）；
 * 2. 50 大姓拼音 → 城市×姓氏页（如 /qiming/sichuan/chengdu/wang）；
 * 3. 其它 → 本省找同名节点的规范地址（301），找不到 404。
 */
export const Route = createFileRoute("/qiming/$province/$place/$county")({
  component: CountyRoutePage,
  loader: async ({ params }) => {
    const tree = await loadProvince(params.province);
    if (!tree) throw notFound();

    const parent = findProvinceChild(tree, params.place);
    const node = parent?.children?.find((child) => child.slug === params.county);
    if (!node) {
      // 城市×姓氏页：父级必须是带下级的地级节点（省直管县没有下辖，不算宿主）
      const surname = surnameByPinyin(params.county);
      if (surname && parent?.children?.length) {
        const place = toPlaceInfo(parent);
        const [stages, samples, note] = await Promise.all([
          getLongtailStages(),
          fetchGalleryPair({ surname: surname.han }),
          fetchSurnameNoteView(surname.han),
        ]);
        return {
          kind: "surnamePlace" as const,
          place,
          provinceSlug: params.province,
          surname,
          ...samples,
          note,
          stages,
        };
      }
      const elsewhere = findPlaceAnywhere(tree, params.county);
      if (elsewhere) throw redirect({ href: elsewhere.path, statusCode: 301 });
      throw notFound();
    }

    const place = toPlaceInfo(node);
    const [samples, stage, stages] = await Promise.all([
      fetchPlaceNameSamples(place.adcode),
      getPlaceRolloutStage(),
      getLongtailStages(),
    ]);
    return { kind: "county" as const, place, ...samples, stage, stages };
  },
  head: ({ loaderData }) =>
    loaderData?.kind === "surnamePlace"
      ? placeSurnameHead(loaderData.place, loaderData.surname, loaderData.stages)
      : placeHead(loaderData?.place, loaderData?.stage),
});

function CountyRoutePage() {
  const data = Route.useLoaderData();
  if (data.kind === "surnamePlace") {
    return (
      <AppShell>
        <PlaceSurnamePage
          place={data.place}
          provinceSlug={data.provinceSlug}
          surname={data.surname}
          boys={data.boys}
          girls={data.girls}
          note={data.note}
        />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PlacePageView
        place={data.place}
        male={data.male}
        female={data.female}
        surnamePlaceStage={data.stages?.surnamePlace ?? 0}
      />
    </AppShell>
  );
}
