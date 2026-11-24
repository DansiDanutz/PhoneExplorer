import { describe, expect, it } from 'vitest';
import { previewModels, previewProfile, previewUrl } from '../web-preview';
import { BUILTIN_PHONE_MODELS } from '../../../shared/phone-models';

describe('iPhone WebKit previews', () => {
  it('includes every iPhone in the device library and valid portrait geometry for every choice', () => {
    for (const m of BUILTIN_PHONE_MODELS.filter(m => m.platform === 'ios'))
      expect(previewModels.map(n => n.toLowerCase())).toContain(m.name.toLowerCase());
    expect(previewModels.length).toBe(54);
    for (const model of previewModels) {
      const p = previewProfile(model);
      expect(p.viewport.height).toBeGreaterThan(p.viewport.width);
      expect(p.hasTouch && p.isMobile).toBe(true);
    }
    expect(previewProfile('iPhone (original)').deviceScaleFactor).toBe(1);
    expect(previewProfile('iPhone 18 Pro Max').viewport.width).toBe(440);
    expect(() => previewProfile('Android')).toThrow();
  });
  it('accepts web pages only', () => {
    expect(previewUrl('https://example.com/#/slots')).toBe('https://example.com/#/slots');
    for (const input of ['file:///etc/hosts','javascript:alert(1)','https://user:secret@example.com']) expect(()=>previewUrl(input)).toThrow();
  });
});
