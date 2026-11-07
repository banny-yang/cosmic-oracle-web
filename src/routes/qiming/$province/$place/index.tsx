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
 * 地级/省直管县级地名页 / 省级×姓氏页：/qiming/{省}/{第二段}。
 *
 * 第二段三种去向，按序判定：
 * 1. 本省下辖节点（地级市/自治州/省直管县）→ 地名页（原有行为优先）；
 * 2. 50 大姓拼音 → 省级×姓氏页（如 /qiming/sichuan/wang「四川王姓小孩取名」；
 *    直辖市 /qiming/beijing/wang 即城市×姓氏页）；
 * 3. 其它 → 本省找同名节点的规范地址（301），找不到 404。
 */
export const Route = createFileRoute("/qiming/$province/$place/")({
  component: PlaceRoutePage,
  loader: async ({ params }) => {
    const tree = await loadProvince(params.province);
    if (!tree) throw notFound();

    const node = findProvinceChild(tree, params.place);
    if (!node) {
      const surname = surnameByPinyin(params.place);
      if (surname) {
        const place = toPlaceInfo(tree);
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
      const elsewhere = findPlaceAnywhere(tree, params.place);
      if (elsewhere) throw redirect({ href: elsewhere.path, statusCode: 301 });
      throw notFound();
    }

    const place = toPlaceInfo(node);
    const [samples, stage, stages] = await Promise.all([
      fetchPlaceNameSamples(place.adcode),
      getPlaceRolloutStage(),
      getLongtailStages(),
    ]);
    return { kind: "place" as const, place, ...samples, stage, stages };
  },
  head: ({ loaderData }) =>
    loaderData?.kind === "surnamePlace"
      ? placeSurnameHead(loaderData.place, loaderData.surname, loaderData.stages)
      : placeHead(loaderData?.place, loaderData?.stage),
});

function PlaceRoutePage() {
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
