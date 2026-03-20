import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, Folder, Table2, Rows3, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from '@/components/motion'
import { cn } from '@/lib/utils'
import { useSearch } from '@/hooks/use-search'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: results, isLoading } = useSearch(query)

  // Build flat list for keyboard nav
  const items: Array<{ type: 'project' | 'table' | 'row'; id: string; label: string; sublabel: string; href: string }> = []
  if (results) {
    for (const p of results.projects) {
      items.push({ type: 'project', id: p.id, label: p.name, sublabel: p.slug, href: `/projects/${p.id}` })
    }
    for (const t of results.tables) {
      items.push({ type: 'table', id: t.id, label: t.name, sublabel: `${t.projectName} · ${t.mode}`, href: `/projects/${t.projectId}/data` })
    }
    for (const r of results.rows) {
      items.push({ type: 'row', id: r.id, label: r.preview.slice(0, 60), sublabel: `${r.projectName} · ${r.tableName}`, href: `/projects/${r.projectId}/data` })
    }
  }

  // Reset on open, focus input after morph finishes
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      const t = setTimeout(() => inputRef.current?.focus(), 180)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => { setSelectedIndex(0) }, [query])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onOpenChange])

  const saveRecent = useCallback((q: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem('flux-search-recent') || '[]') as string[]
      const updated = [q, ...recent.filter(r => r !== q)].slice(0, 5)
      localStorage.setItem('flux-search-recent', JSON.stringify(updated))
    } catch { /* ignore */ }
  }, [])

  const handleSelect = (item: typeof items[0]) => {
    saveRecent(query)
    onOpenChange(false)
    navigate({ to: item.href })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault()
      handleSelect(items[selectedIndex])
    }
  }

  const recentSearches = (() => {
    try {
      return JSON.parse(localStorage.getItem('flux-search-recent') || '[]') as string[]
    } catch { return [] }
  })()

  const TypeIcon = ({ type }: { type: string }) => {
    if (type === 'project') return <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
    if (type === 'table') return <Table2 className="h-4 w-4 text-muted-foreground shrink-0" />
    return <Rows3 className="h-4 w-4 text-muted-foreground shrink-0" />
  }

  return (
    <>
      {/* Backdrop — fades independently */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
        )}
      </AnimatePresence>

      {/* Search panel — shares layoutId with the TopBar button */}
      {open && (
        <motion.div
          layoutId="search-box"
          style={{
            position: 'fixed',
            top: '12vh',
            left: '50%',
            marginLeft: -280,
            width: 560,
            maxWidth: 'calc(100vw - 2rem)',
            zIndex: 51,
            borderRadius: 12,
          }}
          transition={{
            layout: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
          }}
          className="border bg-background shadow-2xl overflow-hidden"
        >
          {/* Input row */}
          <div className="flex items-center border-b px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects, tables, rows..."
              className="flex-1 h-12 px-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <kbd
              className="ml-2 inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground shrink-0 cursor-pointer hover:bg-accent transition-colors"
              onClick={() => onOpenChange(false)}
            >
              esc
            </kbd>
          </div>

          {/* Results — fades in after the morph settles */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12, duration: 0.15 }}
            className="overflow-y-auto"
            style={{ maxHeight: 356 }}
          >
            {query.length < 2 ? (
              <div className="p-4">
                {recentSearches.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium px-2 mb-2">Recent</p>
                    {recentSearches.map(q => (
                      <button
                        key={q}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
                        onClick={() => setQuery(q)}
                      >
                        <Search className="h-3.5 w-3.5 text-muted-foreground" />
                        {q}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Type to search across all projects, tables, and rows.
                  </p>
                )}
              </div>
            ) : items.length === 0 && !isLoading ? (
              <div className="flex flex-col items-center py-8">
                <Search className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {results?.projects.length ? (
                  <ResultGroup title="Projects" items={items} type="project" selectedIndex={selectedIndex} onSelect={handleSelect} onHover={setSelectedIndex} TypeIcon={TypeIcon} />
                ) : null}
                {results?.tables.length ? (
                  <ResultGroup title="Tables" items={items} type="table" selectedIndex={selectedIndex} onSelect={handleSelect} onHover={setSelectedIndex} TypeIcon={TypeIcon} />
                ) : null}
                {results?.rows.length ? (
                  <ResultGroup title="Rows" items={items} type="row" selectedIndex={selectedIndex} onSelect={handleSelect} onHover={setSelectedIndex} TypeIcon={TypeIcon} mono />
                ) : null}
              </div>
            )}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.12 }}
            className="flex items-center px-3 py-2 border-t text-[11px] text-muted-foreground bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px]">↑↓</kbd>
              <span>navigate</span>
              <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px]">↵</kbd>
              <span>select</span>
              <kbd className="px-1.5 py-0.5 rounded border bg-background text-[10px]">esc</kbd>
              <span>close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}

function ResultGroup({
  title, items, type, selectedIndex, onSelect, onHover, TypeIcon, mono,
}: {
  title: string
  items: Array<{ type: string; id: string; label: string; sublabel: string; href: string }>
  type: string
  selectedIndex: number
  onSelect: (item: { type: string; id: string; label: string; sublabel: string; href: string }) => void
  onHover: (idx: number) => void
  TypeIcon: React.FC<{ type: string }>
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground font-medium px-2 py-1">{title}</p>
      {items.filter(i => i.type === type).map((item) => {
        const globalIdx = items.indexOf(item)
        return (
          <button
            key={item.id}
            className={cn(
              'flex items-center gap-3 w-full px-2 py-2 text-sm rounded-md transition-colors text-left',
              globalIdx === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
            )}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(globalIdx)}
          >
            <TypeIcon type={item.type} />
            <div className="flex-1 min-w-0">
              <p className={cn('truncate', mono ? 'font-mono text-xs' : 'font-medium')}>{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
