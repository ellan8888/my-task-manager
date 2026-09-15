"use client";

import { useEffect, useState } from "react";

interface LoadingScreenProps {
  onComplete?: () => void;
  duration?: number; // durasi dalam ms
}

export default function LoadingScreen({ 
  onComplete, 
  duration = 2000 
}: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, duration);

    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration + 500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 bg-[#0b0f19]/95 backdrop-blur-md z-9999 flex flex-col items-center justify-center transition-opacity duration-500 ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Style Reveal: Text Reveal Clip-Path */}
      <style jsx>{`
        @keyframes textRevealSlide {
          0% {
            clip-path: inset(0 100% 0 0);
            opacity: 0;
          }
          100% {
            clip-path: inset(0 0 0 0);
            opacity: 1;
          }
        }

        @keyframes fadeInSubtitle {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-text-reveal {
          animation: textRevealSlide 2s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate;
        }

        .animate-fade-in-subtitle {
          animation: fadeInSubtitle 1.8s ease-in-out infinite alternate;
        }
      `}</style>

      <div className="flex flex-col items-center justify-center text-center px-6">
        {/* Title: Text Reveal */}
        <div className="text-3xl md:text-4xl font-black text-emerald-400 animate-text-reveal tracking-wider mb-3">
          My Task Manager
        </div>

        {/* Progress Bar */}
        <div className="w-36 bg-slate-800 rounded-full h-1.5 overflow-hidden mt-4">
          <div className="bg-linear-to-r from-emerald-500 to-teal-400 h-full rounded-full animate-pulse w-full"></div>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-slate-400 mt-6 animate-fade-in-subtitle font-medium">
          Membuka lembar kerja...
        </p>
      </div>
    </div>
  );
}