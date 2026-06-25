// Shared framer-motion variants and transitions

export const ease = [0.16, 1, 0.3, 1]

export const page = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: 'easeIn' } },
}

export const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const staggerItem = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
}

export const slideRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
}

export const spring = { type: 'spring', stiffness: 420, damping: 30 }
export const springSmooth = { type: 'spring', stiffness: 220, damping: 28 }
export const springBouncy = { type: 'spring', stiffness: 500, damping: 24, mass: 0.8 }
