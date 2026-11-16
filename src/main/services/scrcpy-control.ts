import { promises as fs } from 'node:fs';
import type {
  AndroidKeyCode,
  AndroidMotionEventAction,
  ScrcpyControlMessageWriter,
} from '@yume-chan/scrcpy';

const REMOTE_SERVER = '/data/local/tmp/phoneexplorer-scrcpy-server.jar';
const ACTION = { Down: 0, Up: 1, Move: 2 } as const;

interface ScrcpyClientLike {
  close(): Promise<void>;
  output: unknown;
  exited: Promise<void>;
  controller?: ScrcpyControlMessageWriter;
}

export interface ScrcpyControlOptions {
  serverPath: string;
  onLog?: (message: string) => void;
  onExit?: () => void;
}

/**
 * A control-only scrcpy session. Video stays on the screenshot pipeline for
 * now; scrcpy gives us the thing adb cannot: multi-touch. One session is kept
 * for the active Android device and every gesture falls back to adb when it is
 * not ready.
 */
export class ScrcpyControl {
  private client: ScrcpyClientLike | null = null;
  private writer: ScrcpyControlMessageWriter | null = null;
  private serial: string | null = null;
  private token = 0;
  private starting: Promise<void> | null = null;
  private resize = { width: 1080, height: 2400 };
  private outputTail: string[] = [];

  constructor(private readonly options: ScrcpyControlOptions) {}

  get ready(): boolean {
    return this.writer !== null;
  }

  get deviceSerial(): string | null {
    return this.serial;
  }

  async start(serial: string, width: number, height: number): Promise<void> {
    if (this.writer && this.serial === serial) {
      this.resize = { width, height };
      return;
    }
    if (this.starting) await this.starting;
    if (this.writer && this.serial === serial) return;
    const token = ++this.token;
    this.starting = this.connect(serial, width, height, token);
    let timeout: NodeJS.Timeout | null = null;
    try {
      await Promise.race([
        this.starting,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            if (token === this.token) this.token += 1;
            void this.stopInternal();
            reject(new Error('scrcpy control timed out after 15 seconds'));
          }, 15_000);
        }),
      ]);
      if (!this.writer || this.serial !== serial) {
        throw new Error('The control session was cancelled before it became ready.');
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      this.starting = null;
    }
  }

  private async connect(
    serial: string,
    width: number,
    height: number,
    token: number,
  ): Promise<void> {
    await this.stopInternal();
    const [data, adbModule, tcpModule, scrcpyModule] = await Promise.all([
      fs.readFile(this.options.serverPath),
      import('@yume-chan/adb'),
      import('@yume-chan/adb-server-node-tcp'),
      import('@yume-chan/adb-scrcpy'),
    ]);
    if (token !== this.token) return;

    const port = Number(process.env.ANDROID_ADB_SERVER_PORT ?? 5037) || 5037;
    const connector = new tcpModule.AdbServerNodeTcpConnector({
      host: '127.0.0.1',
      port,
    });
    const server = new adbModule.AdbServerClient(connector);
    const adb = await server.createAdb({ serial });
    if (token !== this.token) return;

    const payload = new Uint8Array(data);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    });
    await scrcpyModule.AdbScrcpyClient.pushServer(
      adb,
      stream as unknown as never,
      REMOTE_SERVER,
    );
    if (token !== this.token) return;

    const scrcpyOptions = new scrcpyModule.AdbScrcpyOptions3_3_3<false>({
      video: false,
      audio: false,
      control: true,
      powerOn: false,
      stayAwake: false,
      clipboardAutosync: false,
      // The dummy byte belongs to the video socket; there is no video here.
      sendDummyByte: false,
      logLevel: 'error',
    });
    const client = (await scrcpyModule.AdbScrcpyClient.start(
      adb,
      REMOTE_SERVER,
      scrcpyOptions,
    )) as unknown as ScrcpyClientLike;
    if (token !== this.token) {
      await client.close().catch(() => undefined);
      return;
    }
    if (!client.controller) {
      await client.close().catch(() => undefined);
      throw new Error('scrcpy started without a control channel');
    }

    this.client = client;
    this.writer = client.controller;
    this.serial = serial;
    this.resize = { width, height };
    this.outputTail = [];
    void this.consumeOutput(client);
    const finish = (): void => {
      if (this.client === client) {
        this.writer = null;
        this.client = null;
        this.serial = null;
        this.options.onLog?.('scrcpy control session ended');
        this.options.onExit?.();
      }
    };
    void client.exited.then(finish, finish);
    this.options.onLog?.(`scrcpy control ready on ${serial}`);
  }

  private async consumeOutput(client: ScrcpyClientLike): Promise<void> {
    try {
      const stream = client.output as ReadableStream<string>;
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const line = String(value).trim();
        if (!line) continue;
        this.outputTail = [...this.outputTail, line].slice(-30);
        if (/error|fail|exception|denied/i.test(line)) {
          this.options.onLog?.(line);
        }
      }
    } catch {
      // The output stream closes when the server exits.
    }
  }

  async stop(): Promise<void> {
    this.token += 1;
    this.starting = null;
    await this.stopInternal();
  }

  private async stopInternal(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.writer = null;
    this.serial = null;
    if (client) await client.close().catch(() => undefined);
  }

  private ensure(): ScrcpyControlMessageWriter {
    if (!this.writer) {
      throw new Error(
        'Multi-touch control is not connected. Check Activity for the scrcpy session.',
      );
    }
    return this.writer;
  }

  private clampPoint(x: number, y: number): { x: number; y: number } {
    const maxX = Math.max(1, this.resize.width - 1);
    const maxY = Math.max(1, this.resize.height - 1);
    return {
      x: Math.max(0, Math.min(maxX, Math.round(x))),
      y: Math.max(0, Math.min(maxY, Math.round(y))),
    };
  }

  private async touch(
    action: AndroidMotionEventAction,
    pointerId: bigint,
    x: number,
    y: number,
    pressure: number,
  ): Promise<void> {
    const writer = this.ensure();
    const point = this.clampPoint(x, y);
    await writer.injectTouch({
      action,
      pointerId,
      pointerX: point.x,
      pointerY: point.y,
      videoWidth: this.resize.width,
      videoHeight: this.resize.height,
      pressure,
      buttons: 0,
      actionButton: 0,
    });
  }

  async tap(x: number, y: number, width: number, height: number): Promise<void> {
    this.resize = { width, height };
    await this.touch(ACTION.Down, 0n, x, y, 1);
    await sleep(24);
    await this.touch(ACTION.Up, 0n, x, y, 0);
  }

  async longPress(
    x: number,
    y: number,
    width: number,
    height: number,
    durationMs = 700,
  ): Promise<void> {
    this.resize = { width, height };
    await this.touch(ACTION.Down, 0n, x, y, 1);
    await sleep(Math.max(300, durationMs));
    await this.touch(ACTION.Up, 0n, x, y, 0);
  }

  async swipe(
    points: Array<{ x: number; y: number }>,
    width: number,
    height: number,
    durationMs = 300,
  ): Promise<void> {
    if (points.length === 0) return;
    this.resize = { width, height };
    const first = points[0];
    await this.touch(ACTION.Down, 0n, first.x, first.y, 1);
    const total = Math.max(4, Math.min(30, Math.round(durationMs / 16)));
    for (let step = 1; step <= total; step += 1) {
      const t = step / total;
      const point = pointOnPath(points, t);
      await this.touch(ACTION.Move, 0n, point.x, point.y, 1);
      await sleep(12);
    }
    const last = points[points.length - 1];
    await this.touch(ACTION.Up, 0n, last.x, last.y, 0);
  }

  async scroll(
    x: number,
    y: number,
    deltaX: number,
    deltaY: number,
    width: number,
    height: number,
  ): Promise<void> {
    this.resize = { width, height };
    const writer = this.ensure();
    const point = this.clampPoint(x, y);
    await writer.injectScroll({
      pointerX: point.x,
      pointerY: point.y,
      videoWidth: this.resize.width,
      videoHeight: this.resize.height,
      scrollX: Math.max(-10, Math.min(10, deltaX / 100)),
      // Browser deltaY is positive scrolling down; Android's AXIS_VSCROLL
      // follows the opposite convention (positive = away from the user).
      scrollY: Math.max(-10, Math.min(10, -deltaY / 100)),
      buttons: 0,
    });
  }

  async pinch(
    centerX: number,
    centerY: number,
    scale: number,
    width: number,
    height: number,
  ): Promise<void> {
    this.resize = { width, height };
    const safeScale = Math.max(0.2, Math.min(5, scale));
    const startDistance = Math.min(170, Math.min(width, height) * 0.2, width * 0.35);
    const endDistance = Math.max(
      20,
      Math.min(startDistance * safeScale, width * 0.8, height * 0.8),
    );
    const cx = Math.max(startDistance, Math.min(width - startDistance, centerX));
    const cy = Math.max(20, Math.min(height - 20, centerY));
    const start = {
      left: { x: cx - startDistance / 2, y: cy },
      right: { x: cx + startDistance / 2, y: cy },
    };
    const end = {
      left: { x: cx - endDistance / 2, y: cy },
      right: { x: cx + endDistance / 2, y: cy },
    };
    await this.touch(ACTION.Down, 0n, start.left.x, start.left.y, 1);
    // scrcpy converts a second ACTION_DOWN into ACTION_POINTER_DOWN with the
    // correct pointer index; the same is true for the matching ACTION_UP.
    await this.touch(ACTION.Down, 1n, start.right.x, start.right.y, 1);
    const steps = 14;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      await this.touch(
        ACTION.Move,
        0n,
        start.left.x + (end.left.x - start.left.x) * t,
        start.left.y + (end.left.y - start.left.y) * t,
        1,
      );
      await this.touch(
        ACTION.Move,
        1n,
        start.right.x + (end.right.x - start.right.x) * t,
        start.right.y + (end.right.y - start.right.y) * t,
        1,
      );
      await sleep(16);
    }
    await this.touch(ACTION.Up, 1n, end.right.x, end.right.y, 0);
    await this.touch(ACTION.Up, 0n, end.left.x, end.left.y, 0);
  }

  async key(keyCode: number): Promise<void> {
    await this.ensure().injectKeyCode({
      keyCode: keyCode as AndroidKeyCode,
      action: 0,
      repeat: 0,
      metaState: 0,
    });
    await sleep(20);
    await this.ensure().injectKeyCode({
      keyCode: keyCode as AndroidKeyCode,
      action: 1,
      repeat: 0,
      metaState: 0,
    });
  }

  lastOutput(): string[] {
    return [...this.outputTail];
  }
}

function pointOnPath(
  points: Array<{ x: number; y: number }>,
  t: number,
): { x: number; y: number } {
  if (points.length === 1) return points[0];
  const segments = points.length - 1;
  const position = t * segments;
  const index = Math.min(segments - 1, Math.floor(position));
  const local = position - index;
  const start = points[index];
  const end = points[index + 1];
  return {
    x: start.x + (end.x - start.x) * local,
    y: start.y + (end.y - start.y) * local,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
