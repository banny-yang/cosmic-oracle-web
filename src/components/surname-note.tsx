/**
 * 姓氏取名提示区块（1A）：/names/{姓}/{生肖} 页的「该姓独有」内容。
 *
 * 600 个姓氏×生肖页此前除姓氏汉字外完全同构，搜索引擎与 AI 抓取时视为重复内容；
 * 这里放的是该姓专属的谐音/连读提示（人写，见 t_surname_note），
 * 与灵感库的避让过滤同一份数据，页面文案与候选名字不会互相打架。
 */
export interface SurnameNoteView {
  found: boolean;
  surname?: string;
  pinyin?: string;
  homophoneNote?: string | null;
  avoidSyllables?: string[];
  avoidChars?: string[];
}

export function SurnameNoteBlock({
  han,
  note,
}: {
  han: string;
  note: SurnameNoteView;
}) {
  const text = (note.homophoneNote || "").trim();
  const syllables = (note.avoidSyllables || []).filter(Boolean);
  if (!text && syllables.length === 0) return null;
  return (
    <section className="mt-4 rounded-2xl bg-white p-6">
      <h2 className="text-lg font-semibold">{han}姓取名的谐音与连读提示</h2>
      {text ? (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft text-pretty">{text}</p>
      ) : null}
      {syllables.length ? (
        <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
          本页候选名字已避开首字读「{syllables.join("／")}」的用法——这些音与「{han}」连读时
          在口语里容易被听成别的词。
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-ink-faint">
        谐音提示为姓名文化参考，不作吉凶判断；最终以字义、读音与书写综合取舍。
      </p>
    </section>
  );
}
