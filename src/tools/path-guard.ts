import { resolve, sep } from 'node:path'

function isInside(root: string, target: string): boolean {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`
  return target === root || target.startsWith(normalizedRoot)
}

/** Resolves a path and ensures it stays inside workspace root. */
export function resolveWorkspacePath(workspace: string, inputPath: string): string {
  const workspaceRoot = resolve(workspace)
  const target = resolve(workspaceRoot, inputPath)

  if (!isInside(workspaceRoot, target)) {
    throw new Error('path must be inside workspace')
  }

  return target
}

/** Validates optional working directory is inside workspace root. */
export function resolveWorkingDir(workspace: string, workingDir?: string): string {
  const workspaceRoot = resolve(workspace)
  if (!workingDir) return workspaceRoot

  const target = resolve(workingDir)
  if (!isInside(workspaceRoot, target)) {
    throw new Error('working_dir must be inside workspace')
  }

  return target
}
