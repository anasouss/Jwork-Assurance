import { ArrowUpDown, ArrowUp } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface SortIconProps {
  isActive: boolean
  direction?: "asc" | "desc"
}

export function SortIcon({ isActive, direction }: SortIconProps) {
  return (
    <div className="ml-1 inline-block">
      <AnimatePresence mode="wait" initial={false}>
        {!isActive ? (
          <motion.div
            key="inactive"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.5, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <ArrowUpDown className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: direction === "desc" ? 180 : 0
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: 0.3,
              ease: "easeInOut"
            }}
          >
            <ArrowUp className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
