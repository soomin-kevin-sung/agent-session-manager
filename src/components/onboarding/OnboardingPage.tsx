import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

type ModelKind = "claude" | "codex";

interface NetworkNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  model: ModelKind;
  phase: number;
}

interface NetworkEdge {
  from: number;
  to: number;
  offset: number;
}

const NODES: NetworkNode[] = [
  { id: "manager", x: 0.5, y: 0.16, radius: 32, color: "#818cf8", model: "claude", phase: 0.1 },
  { id: "lead-a", x: 0.28, y: 0.36, radius: 27, color: "#34d399", model: "codex", phase: 1.3 },
  { id: "lead-b", x: 0.5, y: 0.38, radius: 29, color: "#f59e0b", model: "claude", phase: 2.1 },
  { id: "lead-c", x: 0.72, y: 0.36, radius: 27, color: "#22d3ee", model: "codex", phase: 0.7 },
  { id: "agent-a1", x: 0.15, y: 0.66, radius: 23, color: "#f472b6", model: "codex", phase: 2.8 },
  { id: "agent-a2", x: 0.28, y: 0.72, radius: 23, color: "#a78bfa", model: "claude", phase: 1.9 },
  { id: "agent-a3", x: 0.39, y: 0.64, radius: 22, color: "#2dd4bf", model: "codex", phase: 0.5 },
  { id: "agent-b1", x: 0.48, y: 0.75, radius: 24, color: "#fb7185", model: "claude", phase: 2.5 },
  { id: "agent-b2", x: 0.58, y: 0.66, radius: 22, color: "#84cc16", model: "codex", phase: 1.1 },
  { id: "agent-c1", x: 0.68, y: 0.72, radius: 23, color: "#fb923c", model: "claude", phase: 0.2 },
  { id: "agent-c2", x: 0.8, y: 0.64, radius: 22, color: "#38bdf8", model: "codex", phase: 1.7 },
  { id: "agent-c3", x: 0.88, y: 0.76, radius: 23, color: "#c084fc", model: "claude", phase: 2.9 },
];

const EDGES: NetworkEdge[] = [
  { from: 0, to: 1, offset: -90 },
  { from: 0, to: 2, offset: 0 },
  { from: 0, to: 3, offset: 90 },
  { from: 1, to: 4, offset: -70 },
  { from: 1, to: 5, offset: -20 },
  { from: 1, to: 6, offset: 45 },
  { from: 2, to: 7, offset: -35 },
  { from: 2, to: 8, offset: 45 },
  { from: 3, to: 9, offset: -45 },
  { from: 3, to: 10, offset: 20 },
  { from: 3, to: 11, offset: 70 },
];

function pointOnCurve(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number
) {
  const inv = 1 - t;
  return {
    x: inv * inv * start.x + 2 * inv * t * control.x + t * t * end.x,
    y: inv * inv * start.y + 2 * inv * t * control.y + t * t * end.y,
  };
}

// Pre-create Path2D objects from actual SVG paths for crisp rendering
// Claude logo — official sparkle mark from Simple Icons (viewBox 0 0 24 24)
const CLAUDE_PATH = new Path2D("m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z");

// OpenAI logo — flower knot from official icon (viewBox 0 0 24 24)
const OPENAI_PATH = new Path2D("M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4091-.6765zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6032 1.5018v3.0036l-2.6032 1.5018-2.603-1.5018z");

function drawClaudeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  const scale = (radius * 0.7) / 24; // SVG viewBox is 24x24
  ctx.translate(x - 12 * scale, y - 12 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#D4A574";
  ctx.fill(CLAUDE_PATH);
  ctx.restore();
}

function drawCodexIcon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  const scale = (radius * 0.7) / 24;
  ctx.translate(x - 12 * scale, y - 12 * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill(OPENAI_PATH);
  ctx.restore();
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setWorkspaceCreationModal = useUIStore((s) => s.setWorkspaceCreationModal);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const seconds = reducedMotion ? 0 : time / 1000;
      ctx.clearRect(0, 0, width, height);

      const drift = reducedMotion ? 0 : 1;
      const positions = NODES.map((node) => ({
        ...node,
        px: node.x * width + Math.sin(seconds * 0.7 + node.phase) * 7 * drift,
        py: node.y * height + Math.cos(seconds * 0.55 + node.phase) * 8 * drift,
      }));

      ctx.save();
      ctx.globalAlpha = 0.18;

      for (const edge of EDGES) {
        const fromNode = positions[edge.from];
        const toNode = positions[edge.to];
        const from = { x: fromNode.px, y: fromNode.py };
        const to = { x: toNode.px, y: toNode.py };
        const control = {
          x: (from.x + to.x) / 2 + edge.offset,
          y: (from.y + to.y) / 2 - Math.abs(edge.offset) * 0.2,
        };
        const progress = (seconds * 0.22 + edge.from * 0.11) % 1;
        const reportProgress = (seconds * 0.17 + edge.to * 0.13 + 0.45) % 1;

        ctx.strokeStyle = "rgba(148, 163, 184, 0.34)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
        ctx.stroke();

        ctx.strokeStyle = `${toNode.color}88`;
        ctx.shadowColor = toNode.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        for (let i = 0; i <= 18; i += 1) {
          const trailT = Math.max(0, progress - i * 0.011);
          const point = pointOnCurve(from, control, to, trailT);
          if (i === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();

        // Command dot (from → to, t goes 0→1) and report dot (to → from, t goes 1→0)
        const dots: Array<{ t: number; color: string; targetNode: typeof fromNode; reverse: boolean }> = [
          { t: progress, color: toNode.color, targetNode: toNode, reverse: false },
          { t: 1 - reportProgress, color: fromNode.color, targetNode: fromNode, reverse: true },
        ];
        for (const dot of dots) {
          const point = pointOnCurve(from, control, to, dot.t);
          // Forward dots arrive at t≈1 (near "to"), reverse dots arrive at t≈0 (near "from")
          const arrival = dot.reverse
            ? (dot.t < 0.07 ? (0.07 - dot.t) / 0.07 : 0)
            : (dot.t > 0.93 ? (dot.t - 0.93) / 0.07 : 0);
          ctx.fillStyle = dot.color;
          ctx.shadowColor = dot.color;
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4.4, 0, Math.PI * 2);
          ctx.fill();
          if (arrival > 0) {
            ctx.strokeStyle = dot.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.18 * (1 - arrival);
            ctx.beginPath();
            ctx.arc(dot.targetNode.px, dot.targetNode.py, dot.targetNode.radius + arrival * 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 0.18;
          }
        }

        ctx.shadowBlur = 0;
      }

      // End edge/signal scope (globalAlpha 0.18)
      ctx.restore();

      // Node scope — fully opaque
      ctx.save();
      ctx.globalAlpha = 1;

      for (const node of positions) {
        const gradient = ctx.createRadialGradient(
          node.px - node.radius * 0.35,
          node.py - node.radius * 0.45,
          2,
          node.px,
          node.py,
          node.radius
        );
        // Solid opaque background so lines/signals don't bleed through
        ctx.fillStyle = "#09090b";
        ctx.beginPath();
        ctx.arc(node.px, node.py, node.radius + 1, 0, Math.PI * 2);
        ctx.fill();

        gradient.addColorStop(0, "#2a2a30");
        gradient.addColorStop(1, "#111113");

        ctx.shadowColor = node.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.px, node.py, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = node.color;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (node.model === "claude") drawClaudeIcon(ctx, node.px, node.py, node.radius);
        else drawCodexIcon(ctx, node.px, node.py, node.radius);
      }

      ctx.restore();
      if (!reducedMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const handleResize = () => {
      resize();
      if (reducedMotion) draw(0); // redraw static snapshot after resize
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    if (!reducedMotion) {
      animationFrame = requestAnimationFrame(draw);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#09090b] px-5 text-zinc-100">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(16,185,129,0.13),transparent_34%),linear-gradient(180deg,rgba(9,9,11,0.2),#09090b_88%)]" />
      <section className="relative z-10 w-full max-w-[460px] rounded-xl border border-zinc-700/70 bg-[rgba(9,9,11,0.84)] px-8 py-9 text-center shadow-2xl shadow-emerald-950/30 backdrop-blur-[28px]">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-700 text-3xl shadow-lg shadow-emerald-950/50">
          🤖
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          {t("onboarding.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
          {t("onboarding.subtitle")}
        </p>
        <Button
          size="lg"
          onClick={() => setWorkspaceCreationModal(true)}
          className="mt-8 h-11 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 focus-visible:ring-emerald-500/40"
        >
          {t("onboarding.cta")}
          <ArrowRight className="size-4" />
        </Button>
        <p className="mt-5 text-xs text-zinc-500">{t("onboarding.hint")}</p>
      </section>
    </main>
  );
}
