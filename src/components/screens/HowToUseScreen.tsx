import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  FlaskConical,
  Lock,
  MapPin,
  Printer,
  ShieldCheck,
  Sliders,
  Sparkles,
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
    icon: FlaskConical,
    title: 'Load the reagent registry',
    body: 'Open Reagents and import your data sheet as JSON or CSV. Nothing ships preloaded, because reference colours are evidence and the app will not invent them. Until the registry has entries, photos are still measured and filed, but there is nothing to compare them against.',
    tags: ['Once per kit', 'Reagents page'],
  },
  {
    icon: Sun,
    title: 'Put the reference card in frame',
    body: 'Lay the printed grey card flat beside the sample so both sit in the same light. This is what makes readings comparable between daylight, an office and a torch at night. A card in shade next to a pouch in sun is worse than no card at all.',
    tags: ['Every photo', 'Matte print'],
  },
  {
    icon: Camera,
    title: 'Capture before, then after',
    body: 'Photograph the sample before the reagent goes on. Apply the reagent, wait the read time your registry lists, then photograph again from the same distance and angle. Two frames let the app tell a real reaction apart from a pouch that simply looks dark.',
    tags: ['Two frames', 'Same framing'],
  },
  {
    icon: Eye,
    title: 'Mark the two points',
    body: 'On each photo, tap Reference patch on the grey square, then Reaction point on the pouch. The app measures the card to work out what the light did, cancels it, and reads the reaction colour with that correction applied.',
    tags: ['Tap to place', 'Re-tap to adjust'],
  },
  {
    icon: FileText,
    title: 'Fill in the details and file it',
    body: 'Add your name, designation, station and the reason for the test. Filing captures GPS and timestamp automatically and writes the record to this device, along with both photographs.',
    tags: ['Saved offline', 'GPS and time'],
  },
  {
    icon: Printer,
    title: 'Print the custody report',
    body: 'Any filed case can be reopened from the case log and printed as a chain-of-custody record carrying the officer details, both readings, the location fix and the record hash.',
    tags: ['From case log', 'Any time'],
  },
];

const BENEFITS = [
  {
    icon: Eye,
    title: 'Takes the eye out of the judgement',
    body: 'Two officers can disagree about whether a pouch went purple or dark brown. The app reports a measured colour distance instead of an opinion, and the same photo always gives the same number.',
  },
  {
    icon: Sun,
    title: 'Same reading under any light',
    body: 'A reference surface of known reflectance sits in every photo, so the lighting is measured rather than guessed. Daylight, fluorescent and torchlight are all cancelled the same way.',
  },
  {
    icon: MapPin,
    title: 'Location and time, captured not typed',
    body: 'GPS coordinates with an accuracy figure and a UTC timestamp are attached when the record is filed. Neither is entered by hand, so neither can be misremembered later.',
  },
  {
    icon: Lock,
    title: 'Tamper-evident records',
    body: 'Each record is hashed over its data and its photographs, and each hash is folded into the next. Altering any past record breaks every record filed after it, and the case log shows this.',
  },
  {
    icon: Sparkles,
    title: 'The registry, searchable in the field',
    body: 'Ask the registry answers questions about reagents, substances and colours straight from your loaded data. It needs no signal and reports only what is loaded.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest about being presumptive',
    body: 'The app reports a colour distance, never a confidence percentage. A colour distance is a measurement; a percentage would imply a probability this kind of test cannot support.',
  },
];

const FAQS = [
  {
    q: 'What if I do not have the printed card with me?',
    a: 'Anything you know to be neutral works. Plain white office paper is the usual substitute and a proper grey card is better. With no reference at all the app still records the photo, the metadata and an uncorrected colour, and labels that reading as uncorrected rather than pretending otherwise. You can also read a card once through Lighting reference and reuse that profile, though it assumes the light has not changed since.',
  },
  {
    q: 'Where does the data go?',
    a: 'It stays on this device, in the browser storage, and survives closing the app or restarting the phone. There is no automatic upload. A sync server ships with the project for departments that want records centralised, but it is off unless configured, and even then the device is written first so a dropped connection cannot lose a record.',
  },
  {
    q: 'Does this identify the substance?',
    a: 'No. Colour reagent tests are presumptive. This app makes the reading repeatable and the documentation rigorous. It does not replace laboratory confirmation, and a positive result here is a reason to send the sample onward, not a conclusion.',
  },
  {
    q: 'What does the delta E number mean?',
    a: 'It is the distance between the measured colour and a reference colour from your registry, using CIEDE2000, the international standard for colour difference. Below about 2 the difference is invisible to the eye. Around 5 you would notice it side by side. Above 10 the colours are plainly different.',
  },
  {
    q: 'Why does it want two photographs?',
    a: 'Comparing the before frame against the after frame shows whether the reagent did anything at all. If the two sit close together, no reaction occurred and the result is negative regardless of how dark or coloured the pouch looks on its own.',
  },
  {
    q: 'The camera or location will not start.',
    a: 'Browsers only allow camera and location access on a secure connection. On a phone the page has to be served over https, or opened through localhost on the same machine. Over a plain http address on the local network both will silently do nothing.',
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
          <div className="flex items-center gap-2 text-[11px] font-mono text-white/50 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span>FIELD GUIDE</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-sans uppercase">
            HOW TO USE
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            What this app does, how to take a reading that holds up, and what the numbers on the
            result panel actually mean.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrintGuide}
          className="flex items-center gap-2 px-4 py-2 rounded border border-white/20 bg-white/5 hover:bg-white/15 text-white font-mono text-xs transition-all self-start shrink-0"
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
          <h2 className="text-base font-bold text-white tracking-wide font-sans uppercase">
            Step by step
          </h2>
          <span className="font-mono text-xs text-white/40">{STEPS.length} STEPS</span>
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
                  <span className="font-mono text-[10px] text-white/35 tracking-wider">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white tracking-tight">{step.title}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{step.body}</p>
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                {step.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[9px] uppercase tracking-wider text-white/50 border border-white/12 bg-white/[0.03] px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 border-b border-white/10 pb-2">
          <h2 className="text-xl font-bold text-white tracking-tight font-sans">
            What this changes
          </h2>
          <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
            The chemistry is unchanged. What changes is that the reading is measured rather than
            eyeballed, and the paperwork writes itself.
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
          <h2 className="text-base font-bold text-white tracking-wide font-sans uppercase">
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
        <div className="flex items-center gap-3 font-mono text-xs">
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

        <div className="flex items-center gap-2.5 font-mono text-xs w-full sm:w-auto">
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
