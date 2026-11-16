import { describe, expect, it } from 'vitest';
import { ScrcpyControl } from '../scrcpy-control';

describe('scrcpy control session', () => {
  it('fails closed when the server binary is missing', async () => {
    const control = new ScrcpyControl({ serverPath: '/definitely/not/a/scrcpy-server' });
    await expect(control.start('SERIAL', 1080, 2400)).rejects.toBeTruthy();
    expect(control.ready).toBe(false);
    await expect(control.tap(10, 10, 1080, 2400)).rejects.toThrow(/not connected/i);
    await expect(control.pinch(500, 900, 1.4, 1080, 2400)).rejects.toThrow(/not connected/i);
    await control.stop();
  });
});
