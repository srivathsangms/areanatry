export const CLASSES = 'person,bicycle,car,motorcycle,airplane,bus,train,truck,boat,traffic light,fire hydrant,stop sign,parking meter,bench,bird,cat,dog,horse,sheep,cow,elephant,bear,zebra,giraffe,backpack,umbrella,handbag,tie,suitcase,frisbee,skis,snowboard,sports ball,kite,baseball bat,baseball glove,skateboard,surfboard,tennis racket,bottle,wine glass,cup,fork,knife,spoon,bowl,banana,apple,sandwich,orange,broccoli,carrot,hot dog,pizza,donut,cake,chair,couch,potted plant,bed,dining table,toilet,tv,laptop,mouse,remote,keyboard,cell phone,microwave,oven,toaster,sink,refrigerator,book,clock,vase,scissors,teddy bear,hair drier,toothbrush'.split(',');

export function decodeDetections(output, threshold = 0.45) {
  const data = output.data, count = output.dims[2], boxes = [];
  for (let i = 0; i < count; i++) {
    let score = 0, cls = -1;
    for (let c = 0; c < 80; c++) if (data[(c + 4) * count + i] > score) { score = data[(c + 4) * count + i]; cls = c; }
    if (score < threshold) continue;
    const x = data[i], y = data[count+i], w = data[2*count+i], h = data[3*count+i];
    boxes.push({ cls, label: CLASSES[cls], score, x: (x-w/2)/640, y: (y-h/2)/640, w: w/640, h: h/640 });
  }
  boxes.sort((a,b) => b.score-a.score);
  const kept = [];
  for (const box of boxes) {
    if (kept.some(other => other.cls === box.cls && overlap(box, other) > .5)) continue;
    kept.push(box); if (kept.length >= 12) break;
  }
  return kept;
}
function overlap(a,b) {
  const intersection = Math.max(0, Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) * Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  return intersection / (a.w*a.h+b.w*b.h-intersection || 1);
}
export function position(box) {
  const center = box.x + box.w / 2;
  return center < .36 ? 'left' : center > .64 ? 'right' : 'ahead';
}
