import { useEffect, useRef } from "react"
import { AlertTriangle, ShieldAlert, Shield, Terminal, Trash2, GitBranch, Package } from "lucide-react"

interface ToolConfirmProps {
  confirm: {
    id: string
    tool: string
    args: Record<string, any>
    risk: "high" | "medium" | "low"
    message: string
  }
  onRespond: (id: string, approved: boolean) => void
}

const RISK_CONFIG = {
  high:   { color: "var(--git-deleted)",  icon: ShieldAlert, label: "High Risk"   },
  medium: { color: "var(--git-modified)", icon: AlertTriangle, label: "Medium Risk" },
  low:    { color: "var(--accent)",       icon: Shield,       label: "Low Risk"   },
}

const TOOL_ICONS: Record<string, React.ComponentType<any>> = {
  delete_file:  Trash2,
  run_command:  Terminal,
  run_python:   Terminal,
  npm_command:  Package,
  pip_install:  Package,
  git_command:  GitBranch,
  commit_push:  GitBranch,
  create_branch: GitBranch,
  run_tests:    Terminal,
}

function formatArgs(args: Record<string, any>): string {
  const entries = Object.entries(args)
  if (entries.length === 0) return "(no args)"
  return entries
    .map(([k, v]) => {
      const val = typeof v === "string" ? v : JSON.stringify(v)
      return `${k}: ${val.length > 60 ? val.slice(0, 60) + "…" : val}`
    })
    .join("\n")
}

export default function ToolConfirmModal({ confirm, onRespond }: ToolConfirmProps) {
  const denyRef = useRef<HTMLButtonElement>(null)
  const risk = RISK_CONFIG[confirm.risk] || RISK_CONFIG.medium
  const RiskIcon = risk.icon
  const ToolIcon = TOOL_ICONS[confirm.tool] || Terminal

  // Focus deny button by default — safe choice
  useEffect(() => {
    denyRef.current?.focus()
  }, [confirm.id])

  // Keyboard: Enter = deny (focused), Space on allow = allow
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRespond(confirm.id, false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [confirm.id, onRespond])

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--bg-panel)",
        border: `1px solid ${risk.color}`,
        borderRadius: 12,
        padding: "24px 28px",
        width: 480,
        maxWidth: "90vw",
        boxShadow: `0 0 40px ${risk.color}30`,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <RiskIcon size={20} style={{ color: risk.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: risk.color }}>
              {risk.label} — Agent wants to run a tool
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {confirm.message}
            </div>
          </div>
        </div>

        {/* Tool info */}
        <div style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <ToolIcon size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>
              {confirm.tool}
            </span>
          </div>
          <pre style={{
            fontSize: 11,
            color: "var(--text-muted)",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}>
            {formatArgs(confirm.args)}
          </pre>
        </div>

        {/* Warning for high risk */}
        {confirm.risk === "high" && (
          <div style={{
            background: "rgba(220,50,50,0.08)",
            border: "1px solid rgba(220,50,50,0.2)",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--git-deleted)",
            marginBottom: 16,
          }}>
            ⚠️ This action is <strong>irreversible</strong>. Make sure you understand what will happen before allowing.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            ref={denyRef}
            onClick={() => onRespond(confirm.id, false)}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--bg-input)",
              color: "var(--text)",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            ✕ Deny
          </button>
          <button
            onClick={() => onRespond(confirm.id, true)}
            style={{
              padding: "8px 20px",
              borderRadius: 6,
              border: `1px solid ${risk.color}`,
              background: `${risk.color}18`,
              color: risk.color,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✓ Allow
          </button>
        </div>
      </div>
    </div>
  )
}