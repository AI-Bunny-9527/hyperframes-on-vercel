// lib/composition2.ts
// Applies a viewport-independent text scale and retimes scenes from their actual visible text.
import { buildComposition as baseComposition } from "./composition";

type BaseArgs = Parameters<typeof baseComposition>[0];
type BaseResult = Awaited<ReturnType<typeof baseComposition>>;
type ExtendedArgs = BaseArgs & { textScale?: number };

function fitScript(target: number): string {
  return `
<script>
(function(){
  var TARGET=${target.toFixed(3)};
  function fit(){
    var stage=document.getElementById("stage")||document.body;
    var H=stage.clientHeight||1080;
    var maxH=H*Math.min(0.90, TARGET+0.20);
    var clips=document.querySelectorAll(".clip");
    for(var c=0;c<clips.length;c++){
      (function(clip){
        var box=clip.querySelector(".ed-body")||clip.querySelector(".card")||clip.querySelector(".stack");
        if(!box) return;
        var nodes=[box].concat(Array.prototype.slice.call(box.querySelectorAll("*")));
        var els=[],base=[];
        for(var i=0;i<nodes.length;i++){
          var fs=parseFloat(window.getComputedStyle(nodes[i]).fontSize);
          if(fs>0){ els.push(nodes[i]); base.push(fs); }
        }
        if(!els.length) return;
        function set(f){ for(var i=0;i<els.length;i++){ els[i].style.fontSize=Math.max(10, base[i]*f).toFixed(1)+"px"; } }
        function bad(){
          if(box.getBoundingClientRect().height>maxH) return true;
          for(var i=0;i<els.length;i++){ if(els[i].scrollWidth>els[i].clientWidth+2) return true; }
          return false;
        }
        set(1);
        if(!bad()) return;
        var lo=0.10, hi=1;
        for(var k=0;k<26;k++){ var m=(lo+hi)/2; set(m); if(bad()) hi=m; else lo=m; }
        set(lo);
      })(clips[c]);
    }
  }
  function run(){ try{ fit(); }catch(e){} }
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", run); } else { run(); }
  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(run); }
  setTimeout(run, 300);
  window.__fitText = run;
})();
<\/script>`;
}

function applyScale(html: string, requestedScale: number, aspectRatio: string): string {
  // The base composition already multiplies all typography by width / 1920.
  const width = aspectRatio === "9:16" || aspectRatio === "1:1" || aspectRatio === "4:5" ? 1080 : 1920;
  const baseViewportScale = width / 1920;
  const factor = requestedScale / baseViewportScale;
  let out = html;
  if (Math.abs(factor - 1) >= 0.01) {
    out = out.replace(/font-size:\s*(\d+(?:\.\d+)?)px/g, (_match, value: string) =>
      `font-size:${Math.max(12, Math.round(Number(value) * factor))}px`,
    );
    if (factor > 1.2) {
      out = out.replace(/max-width:\s*\d+(?:\.\d+)?%/g, "max-width:100%");
    }
  }
  // Chosen size = share of the frame the copy should occupy; auto-shrink so it never overflows.
  const target = Math.min(0.85, Math.max(0.18, requestedScale / 5));
  const script = fitScript(target);
  out = out.includes("</body>") ? out.replace("</body>", `${script}\n</body>`) : out + script;
  return out;
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
  const scale = Math.min(3.5, Math.max(0.6, Number(args.textScale) || 1));
  let html = applyScale(String(result.html || ""), scale, args.aspectRatio);
  html = retime(html, Number(result.duration) || 0);
  console.log("[composition2] textScale", scale, "aspectRatio", args.aspectRatio);
  return { ...result, html };
}
