// lib/composition2.ts
// Fits each scene's primary copy to an explicit share of the frame height and
// retimes scenes from their actual visible text.
import { buildComposition as baseComposition } from "./composition";

type BaseArgs = Parameters<typeof baseComposition>[0];
type BaseResult = Awaited<ReturnType<typeof baseComposition>>;
type ExtendedArgs = BaseArgs & { textScale?: number };

function fitScript(target: number): string {
  return `
<script>
(function(){
  var TARGET=${target.toFixed(3)};
  window.__HYPERFRAMES_READY__=false;
  function fit(){
    var stage=document.getElementById("stage")||document.body;
    var H=stage.clientHeight||1080;
    var targetH=H*TARGET;
    var clips=document.querySelectorAll(".clip");
    for(var c=0;c<clips.length;c++){
      (function(clip){
        var primary=clip.querySelector(".ed-head,.headline,.statement,.body,.quote");
        if(!primary) return;
        var original=parseFloat(primary.getAttribute("data-fit-base")||"");
        if(!original){
          original=parseFloat(window.getComputedStyle(primary).fontSize)||48;
          primary.setAttribute("data-fit-base",String(original));
        }
        var originalLine=parseFloat(primary.getAttribute("data-fit-line")||"");
        if(!originalLine){
          originalLine=parseFloat(window.getComputedStyle(primary).lineHeight)||original*1.2;
          primary.setAttribute("data-fit-line",String(originalLine));
        }
        primary.style.maxWidth="100%";
        primary.style.overflowWrap="anywhere";
        primary.style.wordBreak="break-word";
        function set(f){
          primary.style.fontSize=Math.max(10,original*f).toFixed(2)+"px";
          primary.style.lineHeight=Math.max(10,originalLine*f).toFixed(2)+"px";
        }
        function measure(){
          var rect=primary.getBoundingClientRect();
          return {height:rect.height};
        }
        // Search in both directions. The old fitter only shrank text, which
        // made short scenes stay tiny even when 50% was selected.
        var lo=0.05,hi=12;
        for(var k=0;k<30;k++){
          var mid=(lo+hi)/2;
          set(mid);
          var size=measure();
          if(size.height>targetH) hi=mid; else lo=mid;
        }
        set(lo);
        // Line wrapping changes in whole-line jumps. Use line-height only for
        // the small residual gap so the measured copy block reaches TARGET
        // without crossing into an extra line or distorting glyphs.
        var fitted=measure();
        if(fitted.height>0&&fitted.height<targetH){
          var currentLine=parseFloat(window.getComputedStyle(primary).lineHeight)||originalLine*lo;
          primary.style.lineHeight=(currentLine*(targetH/fitted.height)).toFixed(2)+"px";
        }
        primary.setAttribute("data-fit-occupancy",(measure().height/H).toFixed(4));
      })(clips[c]);
    }
  }
  function ready(){
    try{ fit(); }finally{ window.__HYPERFRAMES_READY__=true; }
  }
  function run(){
    if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(ready); }
    else{ ready(); }
  }
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",run); } else { run(); }
  window.__fitText = run;
})();
<\/script>`;
}

function applyScale(html: string, requestedScale: number): string {
  const legacyMapped = requestedScale > 1 ? requestedScale / 5 : requestedScale;
  const target = Math.min(0.75, Math.max(0.15, legacyMapped));
  const script = fitScript(target);
  const gated = html.replace("window.__HYPERFRAMES_READY__ = true;", "window.__HYPERFRAMES_READY__ = false;");
  return gated.includes("</body>") ? gated.replace("</body>", `${script}\n</body>`) : gated + script;
}

function visibleTextLength(chunk: string): number {
  // Prefer the exact burned caption. It is the same scene text and excludes CSS/JS/meta labels.
  const caption = chunk.match(/class="caption"[^>]*>\s*<span>([\s\S]*?)<\/span>/);
  const reveal = chunk.match(/class="[^"]*reveal[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  const source = caption?.[1] ?? reveal?.[1] ?? "";
  const text = source
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|lt|gt|quot|#039);/g, "x")
    .replace(/\s+/g, "");
  return Math.max(6, text.length);
}

function retime(html: string, total: number): string {
  const re = /<div class="clip([^"]*)" id="([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)"/g;
  const clips: Array<{ match: string; cls: string; id: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    clips.push({ match: match[0], cls: match[1], id: match[2], index: match.index });
  }
  if (clips.length < 2 || total <= 0) return html;

  const weights = clips.map((clip, index) => {
    const end = index + 1 < clips.length ? clips[index + 1].index : html.indexOf("<script>", clip.index);
    return visibleTextLength(html.slice(clip.index, end > clip.index ? end : html.length));
  });
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const minScene = Math.min(1.8, total / clips.length);
  let durations = weights.map((weight) => Math.max(minScene, (weight / sum) * total));
  const durationSum = durations.reduce((a, b) => a + b, 0) || 1;
  durations = durations.map((duration) => (duration / durationSum) * total);

  let elapsed = 0;
  let output = html;
  clips.forEach((clip, index) => {
    const replacement = `<div class="clip${clip.cls}" id="${clip.id}" data-start="${elapsed.toFixed(3)}" data-duration="${durations[index].toFixed(3)}"`;
    output = output.replace(clip.match, replacement);
    elapsed += durations[index];
  });
  return output;
}

export async function buildComposition(args: ExtendedArgs): Promise<BaseResult> {
  const result = await baseComposition(args);
  const scale = Math.min(3.5, Math.max(0.15, Number(args.textScale) || 0.35));
  let html = applyScale(String(result.html || ""), scale);
  html = retime(html, Number(result.duration) || 0);
  console.log("[composition2] textScale", scale, "aspectRatio", args.aspectRatio);
  return { ...result, html };
}
