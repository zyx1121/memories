import { AnimatePresence, motion } from "framer-motion";

export default function Loading() {
  return (
    <AnimatePresence>
      <motion.div
        className="w-dvw h-dvh flex items-center justify-center fixed inset-0 z-9999 bg-background"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="w-32 h-32 border-t-2 border-foreground rounded-full blur-lg"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
    </AnimatePresence>
  )
}
