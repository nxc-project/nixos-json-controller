import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, type Dirent } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const licenseFileName = /^(license|licence|copying|notice|unlicense)([._ -].*)?$/i

type PackageLicense = {
  name: string
  version: string
  declaredLicense: string
  repository: string
  files: Array<{ name: string; text: string; hash: string }>
}

function readJsonFile(filePath: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function packageRootForModule(moduleId: string): string | undefined {
  const cleanId = moduleId.split('?')[0]
  if (!path.isAbsolute(cleanId) || !cleanId.includes(`${path.sep}node_modules${path.sep}`)) {
    return undefined
  }

  let directory = path.dirname(cleanId)
  while (directory !== path.dirname(directory)) {
    const packageJson = path.join(directory, 'package.json')
    if (existsSync(packageJson) && readJsonFile(packageJson)?.name) {
      return directory
    }
    if (path.basename(directory) === 'node_modules') break
    directory = path.dirname(directory)
  }
  return undefined
}

function packageRootForImport(specifier: string): string {
  const subpath = specifier.split('?')[0]
  const packageName = subpath.startsWith('@')
    ? subpath.split('/').slice(0, 2).join('/')
    : subpath.split('/')[0]
  if (!packageName || packageName === '.' || packageName.startsWith('/')) {
    throw new Error(`Cannot determine package name for CSS import: ${specifier}`)
  }

  const packageSegments = packageName.split('/')
  let directory = __dirname
  while (true) {
    // Resolve package.json directly instead of require.resolve(): some CSS-only
    // packages export a "style" condition but intentionally block the "require"
    // condition, so require.resolve would silently miss their license metadata.
    const packageRoot = path.join(directory, 'node_modules', ...packageSegments)
    const metadata = readJsonFile(path.join(packageRoot, 'package.json'))
    if (metadata?.name === packageName) return packageRoot

    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  throw new Error(
    `Could not resolve package root for CSS import "${specifier}" (package "${packageName}")`,
  )
}

function collectLicenseFiles(packageRoot: string): PackageLicense['files'] {
  const candidates: string[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(packageRoot, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (entry.isFile() && licenseFileName.test(entry.name)) {
      candidates.push(path.join(packageRoot, entry.name))
      continue
    }
    if (entry.isDirectory() && /^(license|licenses|legal|notices?)$/i.test(entry.name)) {
      const nested = path.join(packageRoot, entry.name)
      try {
        for (const child of readdirSync(nested, { withFileTypes: true })) {
          if (child.isFile() && licenseFileName.test(child.name)) {
            candidates.push(path.join(nested, child.name))
          }
        }
      } catch {
        // An unreadable optional license directory is recorded by the missing-file marker.
      }
    }
  }

  return [...new Set(candidates)].sort().flatMap((filePath) => {
    try {
      const stats = statSync(filePath)
      if (!stats.isFile() || stats.size === 0 || stats.size > 500_000) return []
      const text = readFileSync(filePath, 'utf8')
      if (text.includes('\u0000')) return []
      return [{
        name: path.relative(packageRoot, filePath),
        text,
        hash: createHash('sha256').update(text).digest('hex'),
      }]
    } catch {
      return []
    }
  })
}

function thirdPartyLicenseReport(): Plugin {
  return {
    name: 'nxc-third-party-license-report',
    apply: 'build',
    generateBundle(_options, bundle) {
      const roots = new Map<string, PackageLicense>()
      const addPackage = (root: string | undefined) => {
        if (!root || roots.has(root)) return
        const metadata = readJsonFile(path.join(root, 'package.json'))
        if (!metadata || typeof metadata.name !== 'string') return
        const licenseValue = metadata.license
        const declaredLicense =
          typeof licenseValue === 'string'
            ? licenseValue
            : licenseValue && typeof licenseValue === 'object' && 'type' in licenseValue
              ? String((licenseValue as { type: unknown }).type)
              : 'UNDECLARED'
        const repositoryValue = metadata.repository
        const repository =
          typeof repositoryValue === 'string'
            ? repositoryValue
            : repositoryValue && typeof repositoryValue === 'object' && 'url' in repositoryValue
              ? String((repositoryValue as { url: unknown }).url)
              : 'not declared'
        roots.set(root, {
          name: metadata.name,
          version: typeof metadata.version === 'string' ? metadata.version : 'unknown',
          declaredLicense,
          repository,
          files: collectLicenseFiles(root),
        })
      }

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const moduleId of Object.keys(output.modules)) {
          addPackage(packageRootForModule(moduleId))
        }
      }

      // Vite may fold CSS @imports into one CSS asset instead of keeping their
      // original package paths in JavaScript chunk metadata. Track these direct
      // stylesheet imports as part of the actual production frontend bundle too.
      const sourceCss = readFileSync(path.join(__dirname, 'src', 'index.css'), 'utf8')
      for (const match of sourceCss.matchAll(/@import\s+["']([^"']+)["']/g)) {
        addPackage(packageRootForImport(match[1]))
      }

      const packages = [...roots.values()].sort((a, b) => a.name.localeCompare(b.name))
      const lines = [
        '# Frontend third-party licenses',
        '',
        'This file is generated during the Vite production build from package modules present in the emitted JavaScript bundle and direct stylesheet imports.',
        'It is an inventory for review, not a legal conclusion that every use is cleared. The package manifest license field is reproduced as declared by each package; a missing license file or undeclared license is explicitly marked below.',
        '',
        '## Bundled package inventory',
        '',
        '| Package | Version | Declared license | Repository | License-text files found |',
        '| --- | --- | --- | --- | --- |',
        ...packages.map((item) =>
          `| ${item.name} | ${item.version} | ${item.declaredLicense.replaceAll('|', '\\|')} | ${item.repository.replaceAll('|', '\\|')} | ${item.files.length ? item.files.map((file) => file.name).join(', ').replaceAll('|', '\\|') : 'NONE FOUND'} |`,
        ),
        '',
        '## License texts',
        '',
      ]

      const licenseTexts = new Map<string, { text: string; usedBy: string[]; fileNames: string[] }>()
      for (const item of packages) {
        for (const file of item.files) {
          const current = licenseTexts.get(file.hash)
          if (current) {
            current.usedBy.push(`${item.name}@${item.version}`)
            current.fileNames.push(`${item.name}/${file.name}`)
          } else {
            licenseTexts.set(file.hash, {
              text: file.text,
              usedBy: [`${item.name}@${item.version}`],
              fileNames: [`${item.name}/${file.name}`],
            })
          }
        }
      }

      if (licenseTexts.size === 0) {
        lines.push('No package license text files were found. Treat this as a release-review blocker.')
      }
      let index = 1
      for (const [hash, item] of licenseTexts) {
        lines.push(
          `### License text ${index++} — SHA-256 ${hash}`,
          '',
          `Found at: ${item.fileNames.join(', ')}`,
          `Used by: ${item.usedBy.join(', ')}`,
          '',
          '~~~text',
          item.text.trimEnd(),
          '~~~',
          '',
        )
      }

      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_LICENSES.md',
        source: `${lines.join('\n')}\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), thirdPartyLicenseReport()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
