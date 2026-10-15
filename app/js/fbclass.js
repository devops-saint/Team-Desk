/* =========================================================
   fbclass.js — sorts written feedback into
   Appreciation / Improvement / Other, sentence by sentence.
   Shared by the browser and the central server (Node).
   ========================================================= */
(function (root) {
  'use strict';

  const POS = [
    /\b(great|excellent|outstanding|brilliant|fantastic|amazing|superb|exceptional|impressive|impressed|awesome|stellar)\b/i,
    /\b(well done|good job|nice work|great work|kudos|thank(s| you)|appreciate[ds]?|grateful|shout[- ]?out)\b/i,
    /\b(helpful|supportive|proactive|reliable|dependable|approachable|patient|thorough|responsive|organised|organized|clear|calm|collaborative|creative|innovative|knowledgeable|committed|dedicated|motivat(ed|ing))\b/i,
    /\b(went (above|beyond)|above and beyond|takes? ownership|owned|stepped up|delivered|on time|ahead of (time|schedule)|handled .* well|did (a )?(great|good|excellent)|keep (doing|it up)|continue (to|doing)|strength|strong|role model|mentor(ed|s|ing)?)\b/i,
    /\b(works? (really |very )?well|working (really |very )?well|went well|clear(ly)?|smooth(ly)?)\b/i,
    /\b(like (how|that|the way)|love (how|that|the way)|enjoy(ed)? working|easy to work with|always (helps|available|there))\b/i,
  ];
  const NEG = [
    /\b(could|should|would)\s+(be\s+)?(better|improve|more|less|try|consider|start|stop|work on|focus)/i,
    /\b(could|should)\s+(\w+\s+){0,3}(earlier|sooner|faster|more|less|better|clearer|regularly|often)\b/i,
    /\b(could|should)\s+(also\s+)?(share|try|consider|give|take|spend|communicate|involve|plan|delegate|ask|update|check|listen|prepare|document|escalate|raise|flag)\b/i,
    /\b(need(s|ed)? to|has to|have to|must|ought to)\b/i,
    /\b(improve|improvement|work on|develop|area(s)? (for|to) (improve|develop)|opportunit(y|ies) to|would (like|love) (to see|more|less|if)|wish)\b/i,
    /\b(lack(s|ing)?|miss(es|ed|ing)?|late|delay(ed|s)?|slow|unclear|confus(ed|ing)|inconsistent|struggl(e|es|ed|ing)|difficult|hard to|frustrat(ed|ing)|overload(ed)?|heavy|burn(ed|t)? ?out|stress(ed|ful)?|rude|dismissive|micromanag\w*|blame[ds]?|ignor(e|es|ed|ing)|interrupt\w*|defensive)\b/i,
    /\b(not (always|enough|clear|responsive|available|on time)|too (much|many|often|slow|late|quick|long|high|heavy)|more (often|regular|frequent|clarity|visibility|context|support|time|notice)|less (micro|last[- ]minute))\b/i,
    /\b(issue|problem|concern|complain(t|ed)?|mistake|error|gap|weak(ness)?|risk)\b/i,
    /\b(stop|avoid|reduce|cut down)\b/i,
  ];
  /* "not great", "wasn't helpful" flip appreciation into improvement */
  const NEGATED = /\b(not|never|n't|hardly|rarely|no longer|isn'?t|wasn'?t|doesn'?t|didn'?t)\s+(\w+\s+){0,2}(great|good|helpful|clear|supportive|responsive|reliable|available|proactive|organi[sz]ed|approachable|on time)\b/i;
  /* "no complaints", "nothing to improve" flip improvement into appreciation */
  const NO_ISSUE = /\b(no (issues?|complaints?|concerns?|problems?)|nothing (to improve|to add|negative)|can'?t think of anything|keep it up)\b/i;

  const score = (s, list) => list.reduce((n, rx) => n + (rx.test(s) ? 1 : 0), 0);

  function splitSentences(text) {
    return String(text || '').replace(/\r/g, '').split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9“"(])|^\s*[-•*]\s+/m)
      .map(x => x.replace(/^\s*([-•*]|\d+[.)])\s+/, '').trim()).filter(x => x.length > 2 && /[a-z]/i.test(x));
  }
  /* hint: 'positive' (e.g. "what should they keep doing?"), 'improve' ("what could be better?") or '' */
  function classifySentence(s, hint) {
    if (NO_ISSUE.test(s)) return 'appreciation';
    let p = score(s, POS), n = score(s, NEG);
    if (NEGATED.test(s)) { n += 2; p = Math.max(0, p - 1); }
    if (hint === 'positive') p += 1.5;
    if (hint === 'improve') n += 1.5;
    if (p === 0 && n === 0) return hint === 'positive' ? 'appreciation' : hint === 'improve' ? 'improvement' : 'other';
    if (p > n) return 'appreciation';
    if (n > p) return 'improvement';
    return hint === 'positive' ? 'appreciation' : hint === 'improve' ? 'improvement' : 'other';
  }
  /* items: [{ q, a, hint }] or a plain string. Returns { appreciation:[], improvement:[], other:[] } */
  function classify(items) {
    const out = { appreciation: [], improvement: [], other: [] };
    const list = typeof items === 'string' ? [{ a: items }] : items || [];
    for (const it of list) {
      if (!it || !String(it.a || '').trim()) continue;
      for (const s of splitSentences(it.a)) {
        if (/^(n\/?a|none|nil|no|nothing|nothing (else|really)|not really|-+|\.+)[.!]*$/i.test(s.trim())) continue;
        out[classifySentence(s, it.hint || '')].push(s);
      }
    }
    return out;
  }
  /* question wording tells us what kind of answer to expect */
  function hintFor(q) {
    const t = String(q || '').toLowerCase();
    if (/(keep doing|continue|do well|doing well|went well|strength|appreciate|value most|best thing|proud|enjoy)/.test(t)) return 'positive';
    if (/(better|improve|differently|stop|change|start doing|frustrat|wish|could .* more|less|blocker|challenge|concern|missing)/.test(t)) return 'improve';
    return '';
  }

  const api = { classify, classifySentence, splitSentences, hintFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FBC = api;
})(typeof window !== 'undefined' ? window : globalThis);
