import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crosshair,
  Eye,
  FileText,
  Lock,
  Printer,
  Sliders,
  Sun,
} from 'lucide-react';

interface HowToUseScreenProps {
  onNavigateToIntake?: () => void;
  onOpenCalibration: () => void;
  onTriggerToast: (title: string, msg: string, icon?: string) => void;
}

const panel = {
  background: 'rgba(255, 255, 255, 0.04)',
  backdropFilter: 'blur(20px)',
  boxShadow: 'rgba(255, 255, 255, 0.15) 0px 1px 0px 0px inset',
} as const;

const STEPS = [
  {
    icon: Sun,
    title: 'Card in frame',
    body: 'Lay the printed grey card flat beside the sample so both sit in the same light. This is what makes a reading taken at a roadside comparable with one taken in an office.',
  },
  {
    icon: Camera,
    title: 'Photograph before, then after',
    body: 'One frame before the reagent goes on. Apply it, wait the read time your registry lists, then a second frame from the same distance and angle.',
  },
  {
    icon: Crosshair,
    title: 'Tap the card, then the sample',
    body: 'On each photo, tap Reference patch on the grey square and Reaction point on the sample. This is what performs the correction, and the photo tells you when it is still missing.',
  },
  {
    icon: FileText,
    title: 'Add your details and file it',
    body: 'Name, designation, station and reason. Location and timestamp are captured for you. Filing writes the record and both photographs to this device.',
  },
];

const BENEFITS = [
  {
    icon: Sun,
    title: 'Same reading under any light',
    body: 'A surface of known reflectance sits in every photo, so the lighting is measured rather than guessed. Daylight, fluorescent and torchlight are cancelled the same way.',
  },
  {
    icon: Eye,
    title: 'A number instead of an opinion',
    body: 'Two officers can disagree about whether a pouch went purple or dark brown. The same photograph always produces the same measured colour distance.',
  },
  {
    icon: Lock,
    title: 'Records that show tampering',
    body: 'Each record is hashed over its data and its photographs, and each hash is folded into the next. Altering an old record breaks every record filed after it.',
  },
];

const FAQS = [
  {
    q: 'What if I do not have the card with me?',
    a: 'Anything you know to be neutral works, and plain white paper is the usual substitute. With no reference at all the photo, the metadata and the colour are still recorded, but the reading is marked uncorrected and should not be compared against readings taken under different light.',
  },
  {
    q: 'Does this identify the substance?',
    a: 'No. Colour reagent tests are presumptive. A result here is a reason to send the sample for laboratory confirmation, not a conclusion. Some reagents cannot separate closely related substances at all, and the app shows every candidate rather than picking one.',
  },
  {
    q: 'What does the ΔE number mean?',
    a: 'The distance between the measured colour and a reference colour in your registry. Below about 2 the difference is invisible to the eye, around 5 you would notice it side by side, above 10 the colours are plainly different.',
  },
  {
    q: 'The camera or location will not start.',
    a: 'Browsers only allow camera and location access over a secure connection. The page has to be served over https, or opened through localhost on the same machine. Over a plain http address on a local network both will silently do nothing.',
  },
];

export const HowToUseScreen: React.FC<HowToUseScreenProps> = ({
  onNavigateToIntake,
  onOpenCalibration,
  onTriggerToast,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handlePrintGuide = () => {
    onTriggerToast('Opening print dialog', 'Field guide', 'print');
    window.print();
  };

  return (
    <div id="how-to-use-screen" className="max-w-6xl mx-auto flex flex-col gap-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[11px] text-white/50 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>FIELD GUIDE</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-semibold text-white tracking-tight">
            How to use
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            How to take a reading that holds up, and what the numbers mean.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrintGuide}
          className="flex items-center gap-2 px-4 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white text-xs transition-all self-start shrink-0"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print this guide</span>
        </button>
      </div>

      <div
        className="glass-panel rounded-xl p-5 border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)',
          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.8), inset 0 1px 0 0 rgba(255,255,255,0.2)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg border border-white/25 bg-white/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">The short version</span>
            <span className="text-xs text-white/60">
              Card in frame, photo before, apply reagent, photo after, tap both points, fill in the
              details, file
            </span>
          </div>
        </div>

        {onNavigateToIntake && (
          <button
            type="button"
            onClick={onNavigateToIntake}
            className="flex items-center gap-2 px-4 py-2 rounded bg-white text-black font-semibold text-xs hover:bg-white/90 transition-all shrink-0 shadow-lg"
          >
            <span>Start a field test</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div
        className="rounded-lg p-4 border border-white/20 flex items-start gap-3 text-xs"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <AlertTriangle className="w-4 h-4 text-white shrink-0 mt-0.5" />
        <p className="text-white/75 leading-relaxed">
          Colour reagent tests are <strong className="text-white">presumptive</strong>. A result
          here is grounds for sending the sample for laboratory confirmation, never an
          identification on its own. Handle reagents as corrosive and follow your unit&apos;s
          protective equipment rules.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Step by step
          </h2>
          <span className="text-xs text-white/40">{STEPS.length} STEPS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="glass-panel rounded-xl p-5 flex flex-col justify-between gap-4 border border-white/15 hover:border-white/30 transition-all"
              style={panel}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg border border-white/25 bg-white/5 flex items-center justify-center">
                    <step.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-[10px] text-white/35 tracking-wider">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white tracking-tight">{step.title}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{step.body}</p>
              </div>

            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 border-b border-white/10 pb-2">
          <h2 className="text-xl font-semibold text-white tracking-tight">
            What this changes
          </h2>
          <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
            The chemistry is unchanged. The reading is measured rather than eyeballed, and the
            paperwork writes itself.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="glass-panel rounded-lg p-5 flex flex-col gap-3 border border-white/15"
              style={panel}
            >
              <div className="w-8 h-8 rounded border border-white/20 bg-white/5 flex items-center justify-center">
                <benefit.icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-white">{benefit.title}</h3>
              <p className="text-xs text-white/55 leading-relaxed">{benefit.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Common questions
          </h2>
          <Clock className="w-4 h-4 text-white/30" />
        </div>

        <div className="flex flex-col gap-2">
          {FAQS.map((faq, i) => (
            <div
              key={faq.q}
              className="glass-panel rounded-lg border border-white/12 overflow-hidden"
              style={panel}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
                aria-expanded={openFaq === i}
              >
                <span className="text-xs font-medium text-white">{faq.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-white/50 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <p className="px-4 pb-4 text-xs text-white/60 leading-relaxed border-t border-white/10 pt-3">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/15 bg-black/60">
        <div className="flex items-center gap-3 text-xs">
          <div className="w-8 h-8 rounded border border-white/20 bg-white/5 flex items-center justify-center">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-semibold uppercase">Records stay on this device</span>
            <span className="text-[10px] text-white/50">
              SHA-256 hash chain over metadata and photographs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenCalibration}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white transition-all text-xs"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Lighting reference</span>
          </button>

          {onNavigateToIntake && (
            <button
              type="button"
              onClick={onNavigateToIntake}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded bg-white text-black font-semibold hover:bg-white/90 transition-all text-xs shadow-lg"
            >
              <span>Go to field test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
