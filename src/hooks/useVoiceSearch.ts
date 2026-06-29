import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal Web Speech API typings (not in the standard DOM lib).
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): { transcript: string }
  [index: number]: { transcript: string }
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start(): void
  stop(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Wraps the Web Speech API for one-shot voice dictation.
 * Calls `onFinalTranscript` with each finalized phrase.
 */
export function useVoiceSearch(onFinalTranscript: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const callbackRef = useRef(onFinalTranscript)

  // Keep the latest callback without re-creating the recognition instance.
  useEffect(() => {
    callbackRef.current = onFinalTranscript
  }, [onFinalTranscript])

  const toggle = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      alert('Voice search not supported in your browser')
      return
    }

    if (!recognitionRef.current) {
      const recognition = new Ctor()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            callbackRef.current(result[0].transcript)
          }
        }
      }
      recognitionRef.current = recognition
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
    }
  }, [isListening])

  return { isListening, toggle }
}
