import { describe, expect, it } from 'vitest';
import { decodeDetections, position } from './detection';
describe('YOLO decoding', () => {
  it('decodes COCO scores, suppresses overlapping detections, and labels their position', () => {
    const count = 2, data = new Float32Array(84 * count);
    for (let i = 0; i < count; i++) { data[i]=320; data[count+i]=300; data[2*count+i]=200; data[3*count+i]=250; data[4*count+i]=.9-i*.1; }
    const result = decodeDetections({data,dims:[1,84,count]});
    expect(result).toHaveLength(1); expect(result[0].label).toBe('person'); expect(position(result[0])).toBe('ahead');
  });
});
