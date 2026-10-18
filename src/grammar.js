import { distinctions } from "./distinctions.js";
// Point order follows the supplied Standard Course books, rather than old HSK labels.
export const coursePoints = [
  ["如何", "靠", "居然"],
  ["以来", "临", "立刻"],
  ["各自", "勿", "包括", "时刻"],
  ["至今", "顶", "得不行", "反而"],
  ["起来", "于", "从而", "为"],
  ["替", "说不定", "似的", "纷纷"],
  ["瞎", "分别", "根", "便"],
  ["倒", "来去", "要不"],
  ["算", "作为", "曾经"],
  ["毕竟", "逐渐", "或许"],
  ["过来", "所", "相当", "数"],
  ["以及", "程度"],
  ["何况", "何必", "多亏"],
  ["所谓", "则", "为所", "起"],
  ["过", "迟早", "再三"],
  ["即", "个别", "非"],
  ["以", "平常", "宁可"],
  ["极其", "其余", "可见"],
  ["般", "闻", "趁"],
  ["得起", "支", "凭"],
  ["硬", "偶然", "尽快"],
  ["一旦", "难免", "自从"],
  ["一致", "某", "幸亏"],
  ["行动", "义务"],
  ["朝", "简直"],
  ["来", "至于", "总算"],
  ["下来", "舍不得"],
  ["从此", "假设", "堆"],
  ["不如", "干脆", "万一"],
  ["无意", "有利", "的确"],
  ["嗯", "轻易"],
  ["密切", "尽量", "逐步"],
  ["照常", "难怪", "与其"],
  ["总之", "动词过", "开"],
  ["赶快", "片", "根本"],
  ["除非", "直", "反正"],
];
const rules = {
  来: [
    "Approximate numbers; listing reasons",
    "number (+ measure word) + 来; 一来……，二来……",
    "After a number or number–measure phrase, 来 gives an approximate quantity. 一来……，二来…… lists reasons: for one thing …, for another … .",
  ],
  如果: [
    "If … then …",
    "如果 + condition，就 + result",
    "Introduces a hypothetical condition and its consequence. 的话 can follow the condition.",
  ],
  虽然: [
    "Although …",
    "虽然 + clause，但是 / 可是 + contrasting clause",
    "Acknowledges one fact before presenting a contrasting situation.",
  ],
  因为: [
    "Because …",
    "因为 + reason，所以 + result",
    "Connects a cause with its result; context may allow one connector to be omitted.",
  ],
  只有: [
    "Only if …",
    "只有 + necessary condition，才 + result",
    "States the condition that must be satisfied for the result to occur.",
  ],
  只要: [
    "As long as …",
    "只要 + sufficient condition，就 + result",
    "Presents a condition that is sufficient for the result.",
  ],
  一边: [
    "Doing two things at once",
    "一边 + action，一边 + action",
    "Links two actions taking place at the same time.",
  ],
  越来越: [
    "More and more …",
    "越来越 + adjective / psychological verb",
    "Describes an increasing degree over time.",
  ],
  既然: [
    "Since …",
    "既然 + accepted fact，就 + conclusion",
    "Uses an accepted fact as the basis for a conclusion or suggestion.",
  ],
  即使: [
    "Even if …",
    "即使 + hypothetical condition，也 + result",
    "The result holds even under the stated hypothetical condition.",
  ],
  无论: [
    "No matter …",
    "无论 + alternatives / question word，都 + result",
    "The result remains the same regardless of the condition.",
  ],
  如何: [
    "How; in what way",
    "如何 + verb / subject + 如何",
    "A formal way to ask how something is done. At the end of a sentence it can ask for an opinion or about a situation.",
  ],
  靠: [
    "Lean on; depend on; near",
    "靠在 / 靠着 + noun; 靠 + person / means",
    "靠 can describe physical support, reliance on someone or something, or a position close to a place.",
  ],
  居然: [
    "Contrary to expectations",
    "subject + 居然 + verb phrase",
    "Marks a result that surprises the speaker. The situation turns out differently from what was expected.",
  ],
  以来: [
    "Since a starting point",
    "time / event + 以来",
    "Sets a starting point for a situation continuing up to the reference time.",
  ],
  临: [
    "As an event approaches",
    "临 + event / time + （前）",
    "Introduces the time immediately before an event, or being close to a place.",
  ],
  立刻: [
    "Immediately",
    "subject + 立刻 + verb",
    "Describes an action happening straight away, without delay.",
  ],
  各自: [
    "Each; individually",
    "plural subject + 各自 + verb / 的 + noun",
    "Refers separately to each person or side in a group.",
  ],
  勿: [
    "Do not",
    "勿 + verb",
    "A formal negative imperative, common in signs and written instructions.",
  ],
  包括: [
    "Include",
    "whole + 包括 + parts",
    "Introduces members or parts contained within a larger whole.",
  ],
  时刻: [
    "A moment; at all times",
    "在 + time + 时刻 / 时刻 + verb",
    "As a noun, a particular moment; as an adverb, continuously or at all times.",
  ],
  至今: [
    "Up to now",
    "event / time + 至今",
    "Emphasizes that a state or effect continues until now.",
  ],
  顶: [
    "Extremely; most",
    "顶 + adjective",
    "Can intensify an adjective; also has concrete meanings such as to support or to be on top.",
  ],
  得不行: [
    "Extremely",
    "adjective + 得 + 不行",
    "A degree complement describing an exceptionally strong state.",
  ],
  反而: [
    "Instead; on the contrary",
    "expected outcome，反而 + actual outcome",
    "Introduces an outcome opposite to what the context leads one to expect.",
  ],
  起来: [
    "A change of state or judgment",
    "verb / adjective + 起来",
    "Can mark beginning an action or state. In 看起来 and similar expressions it introduces an impression.",
  ],
  于: [
    "At; in; from",
    "verb / adjective + 于 + noun",
    "A formal preposition whose meaning depends on the expression it follows.",
  ],
  从而: [
    "Thereby",
    "action / condition，从而 + result",
    "Connects a preceding action or condition to the result it brings about.",
  ],
  为: [
    "For; in order to",
    "为 + person / purpose + verb",
    "Introduces a beneficiary or purpose. Pronunciation and meaning depend on use.",
  ],
  替: [
    "For someone; in place of",
    "替 + person + verb",
    "Indicates acting on someone’s behalf or taking their place.",
  ],
  说不定: [
    "Perhaps; might",
    "说不定 + clause",
    "Presents something as a possible but uncertain outcome.",
  ],
  似的: [
    "As if; like",
    "noun / clause + 似的",
    "Makes a comparison, often expressing how a situation looks or feels.",
  ],
  纷纷: [
    "One after another",
    "plural subject + 纷纷 + verb",
    "Describes many people or things taking similar actions in succession.",
  ],
  瞎: [
    "Blind; blindly",
    "瞎 + verb",
    "Before a verb it can describe acting without a basis, purpose or proper judgment.",
  ],
  分别: [
    "Separately; respectively",
    "subject + 分别 + verb",
    "Indicates separate actions or a correspondence between several people or items.",
  ],
  根: [
    "Measure word for long objects",
    "number + 根 + noun",
    "Counts long, relatively thin objects such as ropes and sticks.",
  ],
  便: [
    "Then; naturally",
    "condition，便 + result",
    "Links an outcome closely to the preceding condition; common in written narration.",
  ],
  倒: [
    "Contrary to the expected situation",
    "subject + 倒 + predicate",
    "Introduces a contrast or a mild evaluation that differs from an expectation.",
  ],
  来去: [
    "Repeated movement or action",
    "verb + 来 + verb + 去",
    "Repeating the same verb expresses movement or action back and forth.",
  ],
  要不: [
    "Otherwise; how about",
    "clause，要不 + alternative",
    "Introduces an alternative suggestion or what will happen if an action is not taken.",
  ],
  算: [
    "Count as; consider",
    "算 + noun / adjective",
    "Treats something as belonging to a category or reaching a certain standard.",
  ],
  作为: [
    "As; in the capacity of",
    "作为 + role，clause",
    "Introduces the role or capacity in which someone acts.",
  ],
  曾经: [
    "Once; at some time in the past",
    "曾经 + verb phrase",
    "Describes a past experience or situation.",
  ],
  毕竟: [
    "After all",
    "毕竟 + clause",
    "Reminds the listener of an underlying fact that should be taken into account.",
  ],
  逐渐: [
    "Gradually",
    "逐渐 + verb / adjective",
    "Describes a change that happens step by step over time.",
  ],
  或许: [
    "Perhaps",
    "或许 + clause",
    "Marks a possibility or a tentative judgment.",
  ],
  过来: [
    "Towards the speaker; a recovered state",
    "verb + 过来",
    "A directional complement that can also describe regaining a normal or conscious state.",
  ],
  所: [
    "A nominalizing marker",
    "所 + verb + 的 + noun",
    "A written structure referring to the object affected by the following verb.",
  ],
  相当: [
    "Quite; equivalent",
    "相当 + adjective / 与…相当",
    "Can express a fairly high degree or equality with something else.",
  ],
  数: [
    "Count; rank among",
    "数 + noun / number",
    "As a verb, count or enumerate; pronunciation varies by meaning.",
  ],
  以及: [
    "As well as",
    "noun phrase + 以及 + noun phrase",
    "Connects parallel items, often in a more formal list.",
  ],
  程度: [
    "Degree; extent",
    "…的程度 / 到…程度",
    "Names how far a quality, action or situation develops.",
  ],
  何况: [
    "Let alone; moreover",
    "clause，何况 + clause",
    "Strengthens an argument by introducing an even more compelling case.",
  ],
  何必: [
    "Why bother",
    "何必 + verb phrase + 呢",
    "A rhetorical question suggesting an action is unnecessary.",
  ],
  多亏: [
    "Thanks to",
    "多亏 + person / circumstance，result",
    "Attributes a favorable result to someone or to helpful circumstances.",
  ],
  所谓: [
    "What is called",
    "所谓 + noun / clause",
    "Introduces a term, label or claim for explanation or comment.",
  ],
  则: [
    "Then; whereas",
    "condition，则 + result / A…，B则…",
    "A written connector expressing a result or a contrast.",
  ],
  为所: [
    "A formal passive",
    "subject + 为 + agent + 所 + verb",
    "Shows that the subject is affected by an action performed by the agent.",
  ],
  起: [
    "Begin; from; an occurrence",
    "从…起 / number + 起 + event",
    "Can mark a starting point or count events such as cases and incidents.",
  ],
  过: [
    "Beyond; more than",
    "verb + 过 + noun",
    "Can express passing a point, exceeding, or a comparison; distinguish from experience 过.",
  ],
  迟早: [
    "Sooner or later",
    "迟早 + 会 / 要 + verb",
    "Presents an eventual outcome as certain, with its timing unspecified.",
  ],
  再三: [
    "Repeatedly",
    "再三 + verb",
    "Emphasizes that an action has been done several times.",
  ],
  即: [
    "Namely; immediately",
    "A，即 + B",
    "Often introduces an explanation equivalent to 就是; also has time-related uses.",
  ],
  个别: [
    "Individual; a small minority",
    "个别 + noun",
    "Singles out one or a small number rather than the group as a whole.",
  ],
  非: [
    "Must; not",
    "非 + verb + 不可 / 非 + noun",
    "非…不可 expresses strong necessity; 非 also negates a category in formal language.",
  ],
  以: [
    "By means of; for",
    "以 + means / purpose + verb",
    "Introduces a means, basis or purpose in formal expression.",
  ],
  平常: [
    "Usually; ordinary",
    "平常 + verb / 平常的 + noun",
    "Can mean ordinary, or refer to what is usual in everyday life.",
  ],
  宁可: [
    "Would rather",
    "宁可 + preferred option，也不 + rejected option",
    "Expresses a deliberate preference, often accepting a cost or disadvantage.",
  ],
  极其: [
    "Extremely",
    "极其 + adjective",
    "A formal adverb expressing a very high degree.",
  ],
  其余: [
    "The rest",
    "其余 + noun / 其余的",
    "Refers to the remaining people or things after some have been excluded.",
  ],
  可见: [
    "It can be seen that",
    "evidence，可见 + conclusion",
    "Introduces a conclusion drawn from preceding evidence.",
  ],
  般: [
    "Like; as",
    "noun + 般 + adjective",
    "Makes a vivid comparison, especially in written description.",
  ],
  闻: [
    "Smell; hear of",
    "闻 + smell / news",
    "Can mean to perceive a smell or, in formal expressions, to hear information.",
  ],
  趁: [
    "Take advantage of a time",
    "趁 + favorable situation + verb",
    "An action takes place while helpful circumstances still exist.",
  ],
  得起: [
    "Can afford; can bear",
    "verb + 得 / 不 + 起",
    "A potential complement about whether the cost or burden of an action can be borne.",
  ],
  支: [
    "A measure word",
    "number + 支 + noun",
    "Used for slender objects and, in some contexts, teams or units.",
  ],
  凭: [
    "On the strength of",
    "凭 + basis / means + verb",
    "Introduces the evidence, means or ability relied on for an action.",
  ],
  硬: [
    "Hard; insist on",
    "硬 + verb",
    "Can describe firmness, or insistence on acting despite opposition or difficulty.",
  ],
  偶然: [
    "By chance",
    "偶然 + verb / 偶然的 + noun",
    "Describes something that happens unexpectedly rather than by design.",
  ],
  尽快: [
    "As soon as possible",
    "尽快 + verb",
    "Requests or describes completing an action at the earliest possible time.",
  ],
  一旦: [
    "Once a condition occurs",
    "一旦 + condition，就 + result",
    "Stresses what follows as soon as a particular condition becomes true.",
  ],
  难免: [
    "Hard to avoid",
    "难免 + verb phrase",
    "Indicates that an undesirable outcome is difficult to prevent.",
  ],
  自从: [
    "Ever since",
    "自从 + event / time + 以来，clause",
    "Sets a past starting point for a later continuing situation.",
  ],
  一致: [
    "Consistent; unanimous",
    "一致 + verb / 与…一致",
    "Describes agreement among people or consistency between things.",
  ],
  某: [
    "A certain",
    "某 + person / place / noun",
    "Refers to a particular but unnamed or unspecified person or thing.",
  ],
  幸亏: [
    "Fortunately; thanks to",
    "幸亏 + favorable factor，result",
    "Highlights circumstances that prevented an unfavorable result.",
  ],
  行动: [
    "Act; action",
    "采取行动 / 行动起来",
    "Emphasizes carrying out something in practice.",
  ],
  义务: [
    "Duty; voluntary service",
    "有义务 + verb / 义务 + activity",
    "Can name a responsibility or describe work done voluntarily.",
  ],
  朝: [
    "Towards",
    "朝 + direction / person + verb",
    "Indicates the direction in which an action or movement is aimed.",
  ],
  简直: [
    "Simply; practically",
    "简直 + predicate",
    "Emphasizes an extreme judgment or a striking comparison.",
  ],
  未: [
    "Not yet; have not",
    "未 + verb",
    "A formal negation of an action or state that has not occurred.",
  ],
  至于: [
    "As for",
    "至于 + topic，comment",
    "Introduces another topic or aspect for discussion.",
  ],
  总算: [
    "At last",
    "总算 + verb / adjective",
    "Expresses relief that a desired outcome has finally been reached.",
  ],
  下来: [
    "Down; a continuing result",
    "verb + 下来",
    "A directional complement also used for recording, retaining or settling into a state.",
  ],
  舍不得: [
    "Cannot bear to part with",
    "舍不得 + person / thing / verb",
    "Describes reluctance caused by affection or the perceived value of something.",
  ],
  从此: [
    "From then on",
    "从此 + clause",
    "Introduces a situation beginning at a particular turning point.",
  ],
  假设: [
    "Suppose; hypothesis",
    "假设 + condition，result",
    "Introduces an imagined condition for reasoning.",
  ],
  堆: [
    "A pile; to pile up",
    "一堆 + noun / 堆 + objects",
    "Can describe a heap or the action of collecting objects into a heap.",
  ],
  不如: [
    "Be less good than; better to",
    "A + 不如 + B / 不如 + suggestion",
    "Makes a comparison or proposes a preferable course of action.",
  ],
  干脆: [
    "Simply; decisively",
    "干脆 + verb",
    "Describes acting directly and decisively, often choosing a straightforward solution.",
  ],
  万一: [
    "In case; if unexpectedly",
    "万一 + unlikely situation，就 + response",
    "Introduces a low-probability situation for which a response may be needed.",
  ],
  无意: [
    "Unintentionally",
    "无意 + verb / 无意中",
    "Describes something done without intention or discovered by chance.",
  ],
  有利: [
    "Favorable; beneficial",
    "有利于 + person / outcome",
    "Indicates that something helps bring about a good result.",
  ],
  的确: [
    "Indeed",
    "的确 + predicate",
    "Confirms that a statement or judgment is true.",
  ],
  嗯: [
    "An interjection",
    "嗯 + response",
    "An interjection whose intonation can express agreement, acknowledgment, a question or hesitation.",
  ],
  轻易: [
    "Easily; readily",
    "（不）轻易 + verb",
    "Often used in negative statements about doing something without much thought or difficulty.",
  ],
  密切: [
    "Close; closely",
    "密切 + noun / verb",
    "Describes a close relationship or careful attention to developments.",
  ],
  尽量: [
    "As much as possible",
    "尽量 + verb",
    "Indicates making an effort to reach the greatest feasible extent.",
  ],
  逐步: [
    "Step by step",
    "逐步 + verb",
    "Describes a process progressing in stages.",
  ],
  照常: [
    "As usual",
    "照常 + verb",
    "An action proceeds according to the usual routine despite surrounding circumstances.",
  ],
  难怪: [
    "No wonder",
    "难怪 + observation",
    "Signals that new information explains a previously observed situation.",
  ],
  与其: [
    "Rather than",
    "与其 + option A，不如 + option B",
    "Rejects one option in favor of another considered more appropriate.",
  ],
  总之: [
    "In conclusion",
    "总之，summary",
    "Introduces a summary or overall conclusion.",
  ],
  动词过: [
    "Pass; exceed",
    "verb + 过 + object",
    "A complement about passing a point or exceeding a limit; distinct from experience 过.",
  ],
  开: [
    "Open; apart",
    "verb + 开",
    "A result or directional complement expressing separation, opening or spreading out.",
  ],
  赶快: [
    "Hurry; quickly",
    "赶快 + verb",
    "Urges an action to be taken promptly.",
  ],
  片: [
    "A slice; an expanse",
    "number + 片 + noun",
    "A measure word for slices, flat pieces, areas and some continuous scenes.",
  ],
  根本: [
    "Fundamentally; at all",
    "根本 + 不 / 没 + verb",
    "In negative statements, emphasizes that something is not the case at all.",
  ],
  除非: [
    "Unless",
    "除非 + necessary condition，才 + result",
    "Presents a condition that must be met for an outcome to happen.",
  ],
  直: [
    "Continuously; directly",
    "直 + verb",
    "Can describe a direct line or an action continuing without interruption.",
  ],
  反正: [
    "In any case",
    "反正 + clause",
    "Indicates that a conclusion remains valid regardless of other circumstances.",
  ],
};

export function grammarFor(lesson) {
  if (!lesson) return [];
  const points = lesson.grammarPoints || coursePoints[lesson.number - 1] || [];
  const full = lesson.paragraphs?.flatMap((p) => p.sentences) || [];
  const selected = lesson.number
    ? points
    : Object.keys(rules).filter((p) => p.length > 1 && lesson.text.includes(p));
  const pointsWithExamples = selected.map((point) => {
    const rule = rules[point] || [
      point,
      point,
      "Consult the course notes and examples below for this usage.",
    ];
    const match =
      point === "为所"
        ? /为.+所/
        : point === "来去"
          ? /来.+去/
          : point === "得起"
            ? /[得不]起/
            : point === "得不行"
              ? /得不行/
              : new RegExp(point);
    return {
      point,
      title: rule[0],
      pattern: rule[1],
      explanation: rule[2],
      examples: full.filter((s) => match.test(s.text)),
    };
  });
  const pair = distinctions[lesson.number - 1];
  if (pair)
    pointsWithExamples.push({
      point: `${pair[0]} / ${pair[1]}`,
      title: "Word distinction",
      pattern: `${pair[0]} · ${pair[1]}`,
      explanation: pair[2],
      examples: full.filter(
        (s) => s.text.includes(pair[0]) || s.text.includes(pair[1]),
      ),
    });
  return pointsWithExamples;
}

export function tokenGrammar(token, sentence, grammar) {
  return grammar.filter(
    (g) =>
      g.point.includes(token.text) ||
      token.text.includes(g.point) ||
      (g.examples.some((e) => e.text === sentence.text) &&
        /^(为所|来去|得起|得不行)$/.test(g.point)),
  );
}
