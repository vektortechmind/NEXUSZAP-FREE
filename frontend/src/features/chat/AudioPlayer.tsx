import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AudioPlayerProps = {
  src: string;
  durationMs?: number | null;
  fromMe?: boolean;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function AudioPlayer({ src, durationMs, fromMe = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs ? durationMs / 1000 : 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTime = () => setCurrentTime(audio.currentTime);
    const handleDuration = () => setDuration(audio.duration || (durationMs ? durationMs / 1000 : 0));
    const handleEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", handleTime);
    audio.addEventListener("loadedmetadata", handleDuration);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTime);
      audio.removeEventListener("loadedmetadata", handleDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [durationMs]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    await audio.play();
    setPlaying(true);
  };

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const bars = Array.from({ length: 32 }, (_, index) => {
    const height = 7 + ((index * 7) % 18);
    const active = ((index + 1) / 32) * 100 <= progress;
    return { height, active };
  });
  const buttonClass = fromMe
    ? "bg-white/90 text-emerald-700 hover:bg-white dark:bg-slate-950/85 dark:text-emerald-300"
    : "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-slate-950";
  const inactiveBar = fromMe ? "bg-white/45 dark:bg-slate-950/30" : "bg-slate-300 dark:bg-slate-600";
  const activeBar = fromMe ? "bg-white dark:bg-slate-950/80" : "bg-emerald-500 dark:bg-emerald-400";
  const timeClass = fromMe ? "text-white/80 dark:text-slate-950/70" : "text-slate-500 dark:text-slate-400";

  return (
    <div className="flex min-w-[15rem] max-w-[21rem] items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" controlsList="nodownload" />
      <button
        type="button"
        onClick={() => void toggle()}
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${buttonClass}`}
        aria-label={playing ? "Pausar audio" : "Reproduzir audio"}
      >
        {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} className="ml-0.5" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center gap-[2px]" aria-hidden="true">
          {bars.map((bar, index) => (
            <span
              key={index}
              className={`w-[3px] rounded-full transition-colors ${bar.active ? activeBar : inactiveBar}`}
              style={{ height: `${bar.height}px` }}
            />
          ))}
        </div>
        <p className={`-mt-0.5 text-[11px] font-medium ${timeClass}`}>
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </p>
      </div>
    </div>
  );
}
