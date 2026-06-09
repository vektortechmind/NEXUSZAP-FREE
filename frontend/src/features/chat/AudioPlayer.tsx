import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AudioPlayerProps = {
  src: string;
  durationMs?: number | null;
};

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function AudioPlayer({ src, durationMs }: AudioPlayerProps) {
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

  return (
    <div className="flex min-w-[13rem] items-center gap-3 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/45">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={() => void toggle()}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-emerald-500 dark:text-slate-950"
        aria-label={playing ? "Pausar audio" : "Reproduzir audio"}
      >
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </p>
      </div>
    </div>
  );
}
