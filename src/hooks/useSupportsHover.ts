import { useEffect, useState } from 'react'

/** True only on devices with a real hovering pointer (mouse/trackpad) --
 *  false on touchscreens, where there's no "hover without touching"
 *  gesture at all. The hover-to-preview feature (VideoCard.tsx) is gated
 *  on this: a touch tap has no natural "preview, don't commit" moment the
 *  way a mouse hover does, and there's no mouseleave-equivalent to ever
 *  stop a preview that got stuck playing, so on touch devices a card
 *  falls back to its plain tap-to-open behavior instead of a
 *  half-working hover simulation. */
export function useSupportsHover(): boolean {
  const [supportsHover, setSupportsHover] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(hover: hover) and (pointer: fine)').matches : true,
  )

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setSupportsHover(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return supportsHover
}
