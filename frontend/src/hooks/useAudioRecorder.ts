/**
 * useAudioRecorder — wraps MediaRecorder API for voice capture.
 * Returns base64-encoded audio on stop, plus recording state and analyser level.
 */

import { useCallback, useRef, useState } from "react";

interface AudioRecorderState {
  isRecording: boolean;
  duration: number;
  analyserLevel: number; // 0-1, drives waveform UI
}

interface UseAudioRecorderReturn extends AudioRecorderState {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // base64
  cancelRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    duration: 0,
    analyserLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);

  const updateAnalyser = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(data);
    // Compute RMS level (0-1)
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    setState((s) => ({ ...s, analyserLevel: Math.min(rms * 3, 1) }));
    animFrameRef.current = requestAnimationFrame(updateAnalyser);
  }, []);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      },
    });
    streamRef.current = stream;

    // Set up analyser for waveform
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // MediaRecorder
    const mr = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = mr;
    mr.start(100); // collect in 100ms chunks

    startTimeRef.current = Date.now();
    // Duration timer
    timerRef.current = setInterval(() => {
      setState((s) => ({
        ...s,
        duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 500);

    setState({ isRecording: true, duration: 0, analyserLevel: 0 });
    animFrameRef.current = requestAnimationFrame(updateAnalyser);
  }, [updateAnalyser]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || mr.state === "inactive") {
        resolve(null);
        return;
      }

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        resolve(`data:${mr.mimeType};base64,${b64}`);
      };

      mr.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());

      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setState({ isRecording: false, duration: 0, analyserLevel: 0 });
    });
  }, []);

  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    chunksRef.current = [];
    setState({ isRecording: false, duration: 0, analyserLevel: 0 });
  }, []);

  return { ...state, startRecording, stopRecording, cancelRecording };
}
