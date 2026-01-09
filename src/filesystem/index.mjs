/**
 * Filesystem Path Handling and Glob Pattern Matching
 *
 * This module provides comprehensive file system path abstractions with:
 * - Lazy stat evaluation and caching
 * - LRU caching at multiple levels
 * - Windows and POSIX path handling
 * - Glob pattern matching and compilation
 * - Async and sync APIs
 * - Directory entry caching
 * - Symlink and realpath resolution
 *
 * Originally from path-scurry and minimatch libraries
 */

import { promises as fsPromises, lstatSync, readdirSync, readlinkSync, realpathSync } from 'fs'
import { posix as posixPath, win32 as win32Path } from 'path'
import { fileURLToPath } from 'url'

// ============================================================================
// FILE TYPE CONSTANTS
// ============================================================================

/**
 * File type constants using 4-bit representation
 * These map to standard Unix file type values from stat mode
 */

/** @type {number} Unknown file type */
export const FILE_TYPE_UNKNOWN = 0

/** @type {number} FIFO (named pipe) */
export const FILE_TYPE_FIFO = 1

/** @type {number} Character device */
export const FILE_TYPE_CHARACTER_DEVICE = 2

/** @type {number} Directory */
export const FILE_TYPE_DIRECTORY = 4

/** @type {number} Block device */
export const FILE_TYPE_BLOCK_DEVICE = 6

/** @type {number} Regular file */
export const FILE_TYPE_FILE = 8

/** @type {number} Symbolic link */
export const FILE_TYPE_SYMLINK = 10

/** @type {number} Socket */
export const FILE_TYPE_SOCKET = 12

/** @type {number} Mask for extracting file type (4 bits) */
export const FILE_TYPE_MASK = 15

/** @type {number} Inverse mask for clearing file type bits */
export const FILE_TYPE_CLEAR_MASK = ~FILE_TYPE_MASK

// ============================================================================
// STATE FLAGS
// ============================================================================

/**
 * State flags for PathEntry using bitwise operations
 * These are combined with file type in a single number for compact storage
 */

/** @type {number} Entry has been invalidated and needs refresh */
export const STATE_INVALIDATED = 16

/** @type {number} Stat information has been cached */
export const STATE_STAT_CACHED = 32

/** @type {number} Cannot read directory (not a dir or no permission) */
export const STATE_READDIR_BLOCKED = 64

/** @type {number} lstat has been called on this entry */
export const STATE_LSTAT_CALLED = 128

/** @type {number} readlink failed with an error */
export const STATE_READLINK_ERROR = 256

/** @type {number} readdir has been called on this entry */
export const STATE_READDIR_CALLED = 512

/** @type {number} Combined mask for blocking operations */
export const STATE_BLOCKED_MASK = STATE_READDIR_BLOCKED | STATE_LSTAT_CALLED | STATE_READDIR_CALLED

/** @type {number} Full mask for all state information (10 bits) */
export const STATE_FULL_MASK = 1023

// ============================================================================
// SYMBOLS AND PATTERNS
// ============================================================================

/** @type {Symbol} Used to mark path as current working directory */
export const SET_AS_CWD_SYMBOL = Symbol('PathScurry setAsCwd')

/** @type {RegExp} Windows UNC path pattern detection */
export const UNC_PATH_PATTERN = /^\\\\\\?\\([a-z]:)\\?$/i

/** @type {RegExp} Path separator detection (backslash or forward slash) */
export const PATH_SEPARATOR_PATTERN = /[\\/]/

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** @type {Map<string, string>} Cache for normalized strings */
const normalizedCache = new Map()

/** @type {Map<string, string>} Cache for case-insensitive normalized strings */
const caseInsensitiveCache = new Map()

/**
 * Normalizes a path string using NFKD normalization with caching
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
export function normalizeString(str) {
  let cached = normalizedCache.get(str)
  if (cached) return cached

  const normalized = str.normalize('NFKD')
  normalizedCache.set(str, normalized)
  return normalized
}

/**
 * Case-insensitive path normalization with caching
 * @param {string} str - String to normalize
 * @returns {string} Lowercased and NFKD normalized string
 */
export function normalizeCaseInsensitive(str) {
  let cached = caseInsensitiveCache.get(str)
  if (cached) return cached

  const normalized = normalizeString(str.toLowerCase())
  caseInsensitiveCache.set(str, normalized)
  return normalized
}

/**
 * Maps file stat mode to file type constant
 * @param {import('fs').Stats} stats - Stats object from fs.stat/lstat
 * @returns {number} File type constant
 */
export function getFileTypeFromStats(stats) {
  if (stats.isFile()) return FILE_TYPE_FILE
  if (stats.isDirectory()) return FILE_TYPE_DIRECTORY
  if (stats.isSymbolicLink()) return FILE_TYPE_SYMLINK
  if (stats.isCharacterDevice()) return FILE_TYPE_CHARACTER_DEVICE
  if (stats.isBlockDevice()) return FILE_TYPE_BLOCK_DEVICE
  if (stats.isSocket()) return FILE_TYPE_SOCKET
  if (stats.isFIFO()) return FILE_TYPE_FIFO
  return FILE_TYPE_UNKNOWN
}

/**
 * Normalizes Windows path to use forward slashes
 * @param {string} path - Windows path
 * @returns {string} Normalized path
 */
export function normalizeWindowsPath(path) {
  return path.replace(/\//g, '\\').replace(UNC_PATH_PATTERN, '$1\\')
}

/**
 * Wraps fs module to allow custom implementations
 * @param {Object} customFs - Custom fs implementation
 * @returns {Object} Wrapped fs object
 */
export function wrapFileSystem(customFs) {
  const defaultFs = {
    lstatSync,
    readdir: fsPromises.readdir,
    readdirSync,
    readlinkSync,
    realpathSync: realpathSync.native,
    promises: {
      lstat: fsPromises.lstat,
      readdir: fsPromises.readdir,
      readlink: fsPromises.readlink,
      realpath: fsPromises.realpath
    }
  }

  if (!customFs || customFs === defaultFs) {
    return defaultFs
  }

  return {
    ...defaultFs,
    ...customFs,
    promises: {
      ...defaultFs.promises,
      ...(customFs.promises || {})
    }
  }
}

// ============================================================================
// LRU CACHE CLASSES
// ============================================================================

/**
 * Simple LRU cache for path components
 * Max size: 256 entries
 */
export class PathComponentCache extends Map {
  #maxSize = 256
  #accessOrder = []

  constructor() {
    super()
  }

  get(key) {
    const value = super.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      const idx = this.#accessOrder.indexOf(key)
      if (idx > -1) {
        this.#accessOrder.splice(idx, 1)
        this.#accessOrder.push(key)
      }
    }
    return value
  }

  set(key, value) {
    if (this.size >= this.#maxSize && !this.has(key)) {
      // Evict least recently used
      const lru = this.#accessOrder.shift()
      if (lru) this.delete(lru)
    }
    this.#accessOrder.push(key)
    return super.set(key, value)
  }
}

/**
 * Size-limited LRU cache for directory entries
 * Size calculated based on entry length + 1
 */
export class DirectoryEntryCache extends Map {
  #maxSize
  #currentSize = 0
  #accessOrder = []

  /**
   * @param {number} maxSize - Maximum total size (default 16384)
   */
  constructor(maxSize = 16384) {
    super()
    this.#maxSize = maxSize
  }

  #calculateSize(value) {
    return (value?.length || 0) + 1
  }

  get(key) {
    const value = super.get(key)
    if (value !== undefined) {
      const idx = this.#accessOrder.indexOf(key)
      if (idx > -1) {
        this.#accessOrder.splice(idx, 1)
        this.#accessOrder.push(key)
      }
    }
    return value
  }

  set(key, value) {
    const newSize = this.#calculateSize(value)

    // Evict until we have space
    while (this.#currentSize + newSize > this.#maxSize && this.#accessOrder.length > 0) {
      const lru = this.#accessOrder.shift()
      if (lru && this.has(lru)) {
        const oldValue = super.get(lru)
        this.#currentSize -= this.#calculateSize(oldValue)
        this.delete(lru)
      }
    }

    this.#currentSize += newSize
    this.#accessOrder.push(key)
    return super.set(key, value)
  }
}

// ============================================================================
// PATH ENTRY CLASS
// ============================================================================

/**
 * Core path entry class representing file system nodes with caching and stat info
 *
 * This is the primary file system abstraction class with:
 * - Lazy stat loading
 * - Extensive caching
 * - Bitwise state flags for compact storage
 */
export class PathEntry {
  // Public properties
  name
  root
  roots
  parent
  nocase
  isCWD = false

  // Private properties - File system implementation
  #fs

  // Private properties - Stat information
  #dev           // device number
  #mode          // file mode/permissions
  #nlink         // hard link count
  #uid           // user ID
  #gid           // group ID
  #rdev          // device ID (for special files)
  #blksize       // block size
  #ino           // inode number
  #size          // file size in bytes
  #blocks        // allocated blocks
  #atimeMs       // access time in milliseconds
  #mtimeMs       // modification time in milliseconds
  #ctimeMs       // change time in milliseconds
  #birthtimeMs   // birth time in milliseconds
  #atime         // access time as Date
  #mtime         // modification time as Date
  #ctime         // change time as Date
  #birthtime     // birth time as Date

  // Private properties - Cached paths and state
  #normalizedName    // normalized name for comparison
  #depthCache        // cached depth value
  #fullpathCache     // cached full path
  #fullpathPosix     // cached POSIX full path
  #relativeCache     // cached relative path
  #relativePosix     // cached POSIX relative path
  #stateFlags        // combined file type and state flags
  #childrenCache     // cache for child entries
  #readlinkCache     // cached readlink result
  #realpathCache     // cached realpath result
  #readdirCallbacks = []  // pending readdir callbacks
  #readdirInProgress = false  // readdir operation in progress
  #readdirPromise    // Promise for async readdir

  // Stat getters
  get dev() { return this.#dev }
  get mode() { return this.#mode }
  get nlink() { return this.#nlink }
  get uid() { return this.#uid }
  get gid() { return this.#gid }
  get rdev() { return this.#rdev }
  get blksize() { return this.#blksize }
  get ino() { return this.#ino }
  get size() { return this.#size }
  get blocks() { return this.#blocks }
  get atimeMs() { return this.#atimeMs }
  get mtimeMs() { return this.#mtimeMs }
  get ctimeMs() { return this.#ctimeMs }
  get birthtimeMs() { return this.#birthtimeMs }
  get atime() { return this.#atime }
  get mtime() { return this.#mtime }
  get ctime() { return this.#ctime }
  get birthtime() { return this.#birthtime }

  /**
   * Get parent path string
   * @returns {string}
   */
  get parentPath() {
    return (this.parent || this).fullpath()
  }

  /**
   * Alias for parentPath (Node.js compatibility)
   * @returns {string}
   */
  get path() {
    return this.parentPath
  }

  /**
   * @param {string} name - Entry name
   * @param {number} type - File type constant (default: unknown)
   * @param {PathEntry} root - Root entry
   * @param {Object} roots - Map of root paths to entries
   * @param {boolean} nocase - Case-insensitive comparison
   * @param {DirectoryEntryCache} childrenCache - Cache for children
   * @param {Object} context - Additional context (fullpath, relative, parent, fs)
   */
  constructor(name, type = FILE_TYPE_UNKNOWN, root, roots, nocase, childrenCache, context) {
    this.name = name
    this.#normalizedName = nocase ? normalizeCaseInsensitive(name) : normalizeString(name)
    this.#stateFlags = type & STATE_FULL_MASK
    this.nocase = nocase
    this.roots = roots
    this.root = root || this
    this.#childrenCache = childrenCache
    this.#fullpathCache = context.fullpath
    this.#relativeCache = context.relative
    this.#relativePosix = context.relativePosix
    this.parent = context.parent

    if (this.parent) {
      this.#fs = this.parent.#fs
    } else {
      this.#fs = wrapFileSystem(context.fs)
    }
  }

  /**
   * Get depth of this entry from root
   * @returns {number}
   */
  depth() {
    if (this.#depthCache !== undefined) return this.#depthCache
    if (!this.parent) return this.#depthCache = 0
    return this.#depthCache = this.parent.depth() + 1
  }

  /**
   * Get children cache
   * @returns {DirectoryEntryCache}
   */
  childrenCache() {
    return this.#childrenCache
  }

  /**
   * Resolve a path string to a PathEntry
   * @param {string} pathStr - Path to resolve
   * @returns {PathEntry}
   */
  resolve(pathStr) {
    if (!pathStr) return this

    const rootString = this.getRootString(pathStr)
    const parts = pathStr.substring(rootString.length).split(this.splitSep)

    if (rootString) {
      return this.getRoot(rootString).#resolveParts(parts)
    }
    return this.#resolveParts(parts)
  }

  /**
   * Internal method to resolve path parts
   * @private
   */
  #resolveParts(parts) {
    let current = this
    for (const part of parts) {
      current = current.child(part)
    }
    return current
  }

  /**
   * Get or create children array for this entry
   * @returns {Array} Children array with provisional property
   */
  children() {
    let children = this.#childrenCache.get(this)
    if (children) return children

    children = Object.assign([], { provisional: 0 })
    this.#childrenCache.set(this, children)
    this.#stateFlags &= ~STATE_INVALIDATED
    return children
  }

  /**
   * Get or create a child entry
   * @param {string} name - Child name
   * @param {Object} context - Additional context
   * @returns {PathEntry}
   */
  child(name, context) {
    if (name === '' || name === '.') return this
    if (name === '..') return this.parent || this

    const children = this.children()
    const normalizedName = this.nocase ? normalizeCaseInsensitive(name) : normalizeString(name)

    // Search existing children
    for (const child of children) {
      if (child.#normalizedName === normalizedName) return child
    }

    // Create new child
    const sep = this.parent ? this.sep : ''
    const fullpath = this.#fullpathCache ? this.#fullpathCache + sep + name : undefined

    const newChild = this.newChild(name, FILE_TYPE_UNKNOWN, {
      ...context,
      parent: this,
      fullpath
    })

    if (!this.canReaddir()) {
      newChild.#stateFlags |= STATE_LSTAT_CALLED
    }

    children.push(newChild)
    return newChild
  }

  /**
   * Get relative path from CWD
   * @returns {string}
   */
  relative() {
    if (this.isCWD) return ''
    if (this.#relativeCache !== undefined) return this.#relativeCache

    const name = this.name
    const parent = this.parent

    if (!parent) return this.#relativeCache = this.name

    const parentRelative = parent.relative()
    return parentRelative + (!parentRelative || !parent.parent ? '' : this.sep) + name
  }

  /**
   * Get POSIX-style relative path
   * @returns {string}
   */
  relativePosix() {
    if (this.sep === '/') return this.relative()
    if (this.isCWD) return ''
    if (this.#relativePosix !== undefined) return this.#relativePosix

    const name = this.name
    const parent = this.parent

    if (!parent) return this.#relativePosix = this.fullpathPosix()

    const parentRelative = parent.relativePosix()
    return parentRelative + (!parentRelative || !parent.parent ? '' : '/') + name
  }

  /**
   * Get full absolute path
   * @returns {string}
   */
  fullpath() {
    if (this.#fullpathCache !== undefined) return this.#fullpathCache

    const name = this.name
    const parent = this.parent

    if (!parent) return this.#fullpathCache = this.name

    const fullpath = parent.fullpath() + (!parent.parent ? '' : this.sep) + name
    return this.#fullpathCache = fullpath
  }

  /**
   * Get POSIX-style full path
   * @returns {string}
   */
  fullpathPosix() {
    if (this.#fullpathPosix !== undefined) return this.#fullpathPosix
    if (this.sep === '/') return this.#fullpathPosix = this.fullpath()

    if (!this.parent) {
      const fp = this.fullpath().replace(/\\/g, '/')
      if (/^[a-z]:\//i.test(fp)) {
        return this.#fullpathPosix = `//?/${fp}`
      }
      return this.#fullpathPosix = fp
    }

    const parent = this.parent
    const parentPath = parent.fullpathPosix()
    const fullpath = parentPath + (!parentPath || !parent.parent ? '' : '/') + this.name
    return this.#fullpathPosix = fullpath
  }

  // ============================================================================
  // FILE TYPE CHECKS
  // ============================================================================

  /**
   * Check if file type is unknown
   * @returns {boolean}
   */
  isUnknown() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_UNKNOWN
  }

  /**
   * Check file type by name
   * @param {string} typeName - Type name to check
   * @returns {boolean}
   */
  isType(typeName) {
    return this[`is${typeName}`]()
  }

  /**
   * Get type name string
   * @returns {string}
   */
  getType() {
    if (this.isUnknown()) return 'Unknown'
    if (this.isDirectory()) return 'Directory'
    if (this.isFile()) return 'File'
    if (this.isSymbolicLink()) return 'SymbolicLink'
    if (this.isFIFO()) return 'FIFO'
    if (this.isCharacterDevice()) return 'CharacterDevice'
    if (this.isBlockDevice()) return 'BlockDevice'
    if (this.isSocket()) return 'Socket'
    return 'Unknown'
  }

  /**
   * @returns {boolean}
   */
  isFile() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_FILE
  }

  /**
   * @returns {boolean}
   */
  isDirectory() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_DIRECTORY
  }

  /**
   * @returns {boolean}
   */
  isCharacterDevice() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_CHARACTER_DEVICE
  }

  /**
   * @returns {boolean}
   */
  isBlockDevice() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_BLOCK_DEVICE
  }

  /**
   * @returns {boolean}
   */
  isFIFO() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_FIFO
  }

  /**
   * @returns {boolean}
   */
  isSocket() {
    return (this.#stateFlags & FILE_TYPE_MASK) === FILE_TYPE_SOCKET
  }

  /**
   * @returns {boolean}
   */
  isSymbolicLink() {
    return (this.#stateFlags & FILE_TYPE_SYMLINK) === FILE_TYPE_SYMLINK
  }

  // ============================================================================
  // CACHED ACCESSORS
  // ============================================================================

  /**
   * Get cached lstat result if available
   * @returns {PathEntry|undefined}
   */
  lstatCached() {
    return this.#stateFlags & STATE_STAT_CACHED ? this : undefined
  }

  /**
   * Get cached readlink result if available
   * @returns {PathEntry|undefined}
   */
  readlinkCached() {
    return this.#readlinkCache
  }

  /**
   * Get cached realpath result if available
   * @returns {PathEntry|undefined}
   */
  realpathCached() {
    return this.#realpathCache
  }

  /**
   * Get cached readdir result
   * @returns {Array<PathEntry>}
   */
  readdirCached() {
    const children = this.children()
    return children.slice(0, children.provisional)
  }

  /**
   * Check if readlink can be called
   * @returns {boolean}
   */
  canReadlink() {
    if (this.#readlinkCache) return true
    if (!this.parent) return false

    const type = this.#stateFlags & FILE_TYPE_MASK
    return !(
      type !== FILE_TYPE_UNKNOWN && type !== FILE_TYPE_SYMLINK ||
      this.#stateFlags & STATE_READLINK_ERROR ||
      this.#stateFlags & STATE_LSTAT_CALLED
    )
  }

  /**
   * Check if readdir has been called
   * @returns {boolean}
   */
  calledReaddir() {
    return !!(this.#stateFlags & STATE_INVALIDATED)
  }

  /**
   * Check if entry does not exist (ENOENT)
   * @returns {boolean}
   */
  isENOENT() {
    return !!(this.#stateFlags & STATE_LSTAT_CALLED)
  }

  /**
   * Check if entry matches name (respecting nocase)
   * @param {string} name - Name to compare
   * @returns {boolean}
   */
  isNamed(name) {
    if (!this.nocase) {
      return this.#normalizedName === normalizeString(name)
    }
    return this.#normalizedName === normalizeCaseInsensitive(name)
  }

  // ============================================================================
  // ASYNC FILE OPERATIONS
  // ============================================================================

  /**
   * Read symbolic link target (async)
   * @returns {Promise<PathEntry|undefined>}
   */
  async readlink() {
    const cached = this.#readlinkCache
    if (cached) return cached

    if (!this.canReadlink()) return
    if (!this.parent) return

    try {
      const linkTarget = await this.#fs.promises.readlink(this.fullpath())
      const resolved = (await this.parent.realpath())?.resolve(linkTarget)
      if (resolved) {
        return this.#readlinkCache = resolved
      }
    } catch (err) {
      this.#handleReadlinkError(err.code)
    }
  }

  /**
   * Read symbolic link target (sync)
   * @returns {PathEntry|undefined}
   */
  readlinkSync() {
    const cached = this.#readlinkCache
    if (cached) return cached

    if (!this.canReadlink()) return
    if (!this.parent) return

    try {
      const linkTarget = this.#fs.readlinkSync(this.fullpath())
      const resolved = this.parent.realpathSync()?.resolve(linkTarget)
      if (resolved) {
        return this.#readlinkCache = resolved
      }
    } catch (err) {
      this.#handleReadlinkError(err.code)
    }
  }

  /**
   * Handle readlink errors
   * @private
   */
  #handleReadlinkError(code = '') {
    let flags = this.#stateFlags
    flags |= STATE_READLINK_ERROR

    if (code === 'ENOENT') flags |= STATE_LSTAT_CALLED
    if (code === 'EINVAL' || code === 'UNKNOWN') flags &= FILE_TYPE_CLEAR_MASK

    this.#stateFlags = flags

    if (code === 'ENOTDIR' && this.parent) {
      this.parent.#markReaddirBlocked()
    }
  }

  /**
   * Mark children as read from directory
   * @private
   */
  #markChildrenRead(children) {
    this.#stateFlags |= STATE_INVALIDATED

    // Mark provisional children that weren't found as non-existent
    for (let i = children.provisional; i < children.length; i++) {
      const child = children[i]
      if (child) child.#markNotExists()
    }
  }

  /**
   * Mark entry as not existing
   * @private
   */
  #markNotExists() {
    if (this.#stateFlags & STATE_LSTAT_CALLED) return
    this.#stateFlags = (this.#stateFlags | STATE_LSTAT_CALLED) & FILE_TYPE_CLEAR_MASK
    this.#clearChildren()
  }

  /**
   * Clear children entries
   * @private
   */
  #clearChildren() {
    const children = this.children()
    children.provisional = 0
    for (const child of children) {
      child.#markNotExists()
    }
  }

  /**
   * Mark readdir as called
   * @private
   */
  #markReaddirCalled() {
    this.#stateFlags |= STATE_READDIR_CALLED
    this.#markReaddirBlocked()
  }

  /**
   * Mark directory as unreadable
   * @private
   */
  #markReaddirBlocked() {
    if (this.#stateFlags & STATE_READDIR_BLOCKED) return

    let flags = this.#stateFlags
    if ((flags & FILE_TYPE_MASK) === FILE_TYPE_DIRECTORY) {
      flags &= FILE_TYPE_CLEAR_MASK
    }
    this.#stateFlags = flags | STATE_READDIR_BLOCKED
    this.#clearChildren()
  }

  /**
   * Handle readdir errors
   * @private
   */
  #handleReaddirError(code = '') {
    if (code === 'ENOTDIR' || code === 'EPERM') {
      this.#markReaddirBlocked()
    } else if (code === 'ENOENT') {
      this.#markNotExists()
    } else {
      this.children().provisional = 0
    }
  }

  /**
   * Handle lstat errors
   * @private
   */
  #handleLstatError(code = '') {
    if (code === 'ENOTDIR') {
      this.parent.#markReaddirBlocked()
    } else if (code === 'ENOENT') {
      this.#markNotExists()
    }
  }

  /**
   * Add or update child entry from dirent
   * @private
   */
  #addOrUpdateChild(dirent, children) {
    return this.#findExistingChild(dirent, children) || this.#createNewChild(dirent, children)
  }

  /**
   * Create new child from dirent
   * @private
   */
  #createNewChild(dirent, children) {
    const type = getFileTypeFromStats(dirent)
    const newChild = this.newChild(dirent.name, type, { parent: this })

    const childType = newChild.#stateFlags & FILE_TYPE_MASK
    if (childType !== FILE_TYPE_DIRECTORY && childType !== FILE_TYPE_SYMLINK && childType !== FILE_TYPE_UNKNOWN) {
      newChild.#stateFlags |= STATE_READDIR_BLOCKED
    }

    children.unshift(newChild)
    children.provisional++
    return newChild
  }

  /**
   * Find existing child matching dirent
   * @private
   */
  #findExistingChild(dirent, children) {
    for (let i = children.provisional; i < children.length; i++) {
      const child = children[i]
      const normalizedName = this.nocase ? normalizeCaseInsensitive(dirent.name) : normalizeString(dirent.name)
      if (normalizedName !== child.#normalizedName) continue
      return this.#updateExistingChild(dirent, child, i, children)
    }
  }

  /**
   * Update existing child from dirent
   * @private
   */
  #updateExistingChild(dirent, child, index, children) {
    const oldName = child.name
    child.#stateFlags = child.#stateFlags & FILE_TYPE_CLEAR_MASK | getFileTypeFromStats(dirent)

    if (oldName !== dirent.name) {
      child.name = dirent.name
    }

    if (index !== children.provisional) {
      if (index === children.length - 1) {
        children.pop()
      } else {
        children.splice(index, 1)
      }
      children.unshift(child)
    }

    children.provisional++
    return child
  }

  /**
   * Get file stats (async)
   * @returns {Promise<PathEntry|undefined>}
   */
  async lstat() {
    if ((this.#stateFlags & STATE_LSTAT_CALLED) === 0) {
      try {
        this.#applyStats(await this.#fs.promises.lstat(this.fullpath()))
        return this
      } catch (err) {
        this.#handleLstatError(err.code)
      }
    }
  }

  /**
   * Get file stats (sync)
   * @returns {PathEntry|undefined}
   */
  lstatSync() {
    if ((this.#stateFlags & STATE_LSTAT_CALLED) === 0) {
      try {
        this.#applyStats(this.#fs.lstatSync(this.fullpath()))
        return this
      } catch (err) {
        this.#handleLstatError(err.code)
      }
    }
  }

  /**
   * Apply stats to this entry
   * @private
   */
  #applyStats(stats) {
    const {
      atime, atimeMs, birthtime, birthtimeMs, blksize, blocks,
      ctime, ctimeMs, dev, gid, ino, mode, mtime, mtimeMs,
      nlink, rdev, size, uid
    } = stats

    this.#atime = atime
    this.#atimeMs = atimeMs
    this.#birthtime = birthtime
    this.#birthtimeMs = birthtimeMs
    this.#blksize = blksize
    this.#blocks = blocks
    this.#ctime = ctime
    this.#ctimeMs = ctimeMs
    this.#dev = dev
    this.#gid = gid
    this.#ino = ino
    this.#mode = mode
    this.#mtime = mtime
    this.#mtimeMs = mtimeMs
    this.#nlink = nlink
    this.#rdev = rdev
    this.#size = size
    this.#uid = uid

    const type = getFileTypeFromStats(stats)
    this.#stateFlags = this.#stateFlags & FILE_TYPE_CLEAR_MASK | type | STATE_STAT_CACHED

    if (type !== FILE_TYPE_UNKNOWN && type !== FILE_TYPE_DIRECTORY && type !== FILE_TYPE_SYMLINK) {
      this.#stateFlags |= STATE_READDIR_BLOCKED
    }
  }

  /**
   * Notify pending readdir callbacks
   * @private
   */
  #notifyReaddirCallbacks(result) {
    this.#readdirInProgress = false
    const callbacks = this.#readdirCallbacks.slice()
    this.#readdirCallbacks.length = 0
    callbacks.forEach(cb => cb(null, result))
  }

  /**
   * Read directory with callback
   * @param {Function} callback - Callback function (err, entries)
   * @param {boolean} sync - Whether to run synchronously
   */
  readdirCB(callback, sync = false) {
    if (!this.canReaddir()) {
      if (sync) {
        callback(null, [])
      } else {
        queueMicrotask(() => callback(null, []))
      }
      return
    }

    const children = this.children()
    if (this.calledReaddir()) {
      const result = children.slice(0, children.provisional)
      if (sync) {
        callback(null, result)
      } else {
        queueMicrotask(() => callback(null, result))
      }
      return
    }

    this.#readdirCallbacks.push(callback)
    if (this.#readdirInProgress) return

    this.#readdirInProgress = true
    const fullpath = this.fullpath()

    this.#fs.readdir(fullpath, { withFileTypes: true }, (err, entries) => {
      if (err) {
        this.#handleReaddirError(err.code)
        children.provisional = 0
      } else {
        for (const entry of entries) {
          this.#addOrUpdateChild(entry, children)
        }
        this.#markChildrenRead(children)
      }
      this.#notifyReaddirCallbacks(children.slice(0, children.provisional))
    })
  }

  /**
   * Read directory (async)
   * @returns {Promise<Array<PathEntry>>}
   */
  async readdir() {
    if (!this.canReaddir()) return []

    const children = this.children()
    if (this.calledReaddir()) {
      return children.slice(0, children.provisional)
    }

    const fullpath = this.fullpath()

    if (this.#readdirPromise) {
      await this.#readdirPromise
    } else {
      let resolve = () => {}
      this.#readdirPromise = new Promise(r => resolve = r)

      try {
        const entries = await this.#fs.promises.readdir(fullpath, { withFileTypes: true })
        for (const entry of entries) {
          this.#addOrUpdateChild(entry, children)
        }
        this.#markChildrenRead(children)
      } catch (err) {
        this.#handleReaddirError(err.code)
        children.provisional = 0
      }

      this.#readdirPromise = undefined
      resolve()
    }

    return children.slice(0, children.provisional)
  }

  /**
   * Read directory (sync)
   * @returns {Array<PathEntry>}
   */
  readdirSync() {
    if (!this.canReaddir()) return []

    const children = this.children()
    if (this.calledReaddir()) {
      return children.slice(0, children.provisional)
    }

    const fullpath = this.fullpath()

    try {
      const entries = this.#fs.readdirSync(fullpath, { withFileTypes: true })
      for (const entry of entries) {
        this.#addOrUpdateChild(entry, children)
      }
      this.#markChildrenRead(children)
    } catch (err) {
      this.#handleReaddirError(err.code)
      children.provisional = 0
    }

    return children.slice(0, children.provisional)
  }

  /**
   * Check if this entry can have readdir called
   * @returns {boolean}
   */
  canReaddir() {
    if (this.#stateFlags & STATE_BLOCKED_MASK) return false

    const type = FILE_TYPE_MASK & this.#stateFlags
    if (!(type === FILE_TYPE_UNKNOWN || type === FILE_TYPE_DIRECTORY || type === FILE_TYPE_SYMLINK)) {
      return false
    }

    return true
  }

  /**
   * Check if this entry should be walked during glob
   * @param {Set<PathEntry>} walkedSet - Set of already walked entries
   * @param {Function} filter - Optional filter function
   * @returns {boolean}
   */
  shouldWalk(walkedSet, filter) {
    return (
      (this.#stateFlags & FILE_TYPE_DIRECTORY) === FILE_TYPE_DIRECTORY &&
      !(this.#stateFlags & STATE_BLOCKED_MASK) &&
      !walkedSet.has(this) &&
      (!filter || filter(this))
    )
  }

  /**
   * Get real path (async)
   * @returns {Promise<PathEntry|undefined>}
   */
  async realpath() {
    if (this.#realpathCache) return this.#realpathCache
    if ((STATE_READDIR_CALLED | STATE_READLINK_ERROR | STATE_LSTAT_CALLED) & this.#stateFlags) return

    try {
      const realPath = await this.#fs.promises.realpath(this.fullpath())
      return this.#realpathCache = this.resolve(realPath)
    } catch (err) {
      this.#markReaddirCalled()
    }
  }

  /**
   * Get real path (sync)
   * @returns {PathEntry|undefined}
   */
  realpathSync() {
    if (this.#realpathCache) return this.#realpathCache
    if ((STATE_READDIR_CALLED | STATE_READLINK_ERROR | STATE_LSTAT_CALLED) & this.#stateFlags) return

    try {
      const realPath = this.#fs.realpathSync(this.fullpath())
      return this.#realpathCache = this.resolve(realPath)
    } catch (err) {
      this.#markReaddirCalled()
    }
  }

  /**
   * Set this entry as current working directory
   * @param {PathEntry} oldCwd - Previous CWD entry
   */
  [SET_AS_CWD_SYMBOL](oldCwd) {
    if (oldCwd === this) return

    oldCwd.isCWD = false
    this.isCWD = true

    const ancestors = new Set([])
    const parts = []
    let current = this

    while (current && current.parent) {
      ancestors.add(current)
      current.#relativeCache = parts.join(this.sep)
      current.#relativePosix = parts.join('/')
      current = current.parent
      parts.push('..')
    }

    current = oldCwd
    while (current && current.parent && !ancestors.has(current)) {
      current.#relativeCache = undefined
      current.#relativePosix = undefined
      current = current.parent
    }
  }

  // Abstract methods - must be overridden by subclasses
  getRootString(path) { throw new Error('Must be implemented by subclass') }
  getRoot(rootStr) { throw new Error('Must be implemented by subclass') }
  newChild(name, type, context) { throw new Error('Must be implemented by subclass') }
  get sep() { throw new Error('Must be implemented by subclass') }
  get splitSep() { throw new Error('Must be implemented by subclass') }
}

// ============================================================================
// POSIX PATH ENTRY
// ============================================================================

/**
 * POSIX/Unix path implementation
 * Uses forward slash as separator
 */
export class PosixPathEntry extends PathEntry {
  splitSep = '/'
  sep = '/'

  /**
   * @param {string} name - Entry name
   * @param {number} type - File type constant
   * @param {PathEntry} root - Root entry
   * @param {Object} roots - Map of root paths
   * @param {boolean} nocase - Case-insensitive comparison
   * @param {DirectoryEntryCache} childrenCache - Children cache
   * @param {Object} context - Additional context
   */
  constructor(name, type = FILE_TYPE_UNKNOWN, root, roots, nocase, childrenCache, context) {
    super(name, type, root, roots, nocase, childrenCache, context)
  }

  /**
   * Get root string from path
   * @param {string} path - Path to parse
   * @returns {string}
   */
  getRootString(path) {
    return path.startsWith('/') ? '/' : ''
  }

  /**
   * Get root entry (always returns this.root for POSIX)
   * @param {string} rootStr - Root string
   * @returns {PathEntry}
   */
  getRoot(rootStr) {
    return this.root
  }

  /**
   * Create new child entry
   * @param {string} name - Child name
   * @param {number} type - File type
   * @param {Object} context - Context
   * @returns {PosixPathEntry}
   */
  newChild(name, type = FILE_TYPE_UNKNOWN, context = {}) {
    return new PosixPathEntry(
      name,
      type,
      this.root,
      this.roots,
      this.nocase,
      this.childrenCache(),
      context
    )
  }
}

// ============================================================================
// WINDOWS PATH ENTRY
// ============================================================================

/**
 * Windows path implementation
 * Handles backslash separators and drive letters
 */
export class WindowsPathEntry extends PathEntry {
  sep = '\\'
  splitSep = PATH_SEPARATOR_PATTERN

  /**
   * @param {string} name - Entry name
   * @param {number} type - File type constant
   * @param {PathEntry} root - Root entry
   * @param {Object} roots - Map of root paths
   * @param {boolean} nocase - Case-insensitive comparison
   * @param {DirectoryEntryCache} childrenCache - Children cache
   * @param {Object} context - Additional context
   */
  constructor(name, type = FILE_TYPE_UNKNOWN, root, roots, nocase, childrenCache, context) {
    super(name, type, root, roots, nocase, childrenCache, context)
  }

  /**
   * Get root string from path
   * @param {string} path - Path to parse
   * @returns {string}
   */
  getRootString(path) {
    return win32Path.parse(path).root
  }

  /**
   * Get root entry for given root string
   * @param {string} rootStr - Root string (e.g., "C:\\")
   * @returns {PathEntry}
   */
  getRoot(rootStr) {
    rootStr = normalizeWindowsPath(rootStr.toUpperCase())

    if (rootStr === this.root.name) {
      return this.root
    }

    for (const [key, value] of Object.entries(this.roots)) {
      if (this.sameRoot(rootStr, key)) {
        this.roots[rootStr] = value
        return value
      }
    }

    // Create new root entry
    return this.roots[rootStr] = new WindowsPathScurry(rootStr, this).root
  }

  /**
   * Check if two root strings are the same
   * @param {string} a - First root
   * @param {string} b - Second root (default: this.root.name)
   * @returns {boolean}
   */
  sameRoot(a, b = this.root.name) {
    a = a.toUpperCase().replace(/\//g, '\\').replace(UNC_PATH_PATTERN, '$1\\')
    return a === b
  }

  /**
   * Create new child entry
   * @param {string} name - Child name
   * @param {number} type - File type
   * @param {Object} context - Context
   * @returns {WindowsPathEntry}
   */
  newChild(name, type = FILE_TYPE_UNKNOWN, context = {}) {
    return new WindowsPathEntry(
      name,
      type,
      this.root,
      this.roots,
      this.nocase,
      this.childrenCache(),
      context
    )
  }
}

// ============================================================================
// PATH SCURRY BASE CLASS
// ============================================================================

/**
 * Path scurry base class for path manipulation and caching
 * Central path resolution and caching manager with platform-specific handling
 */
export class PathScurry {
  root
  rootPath
  roots
  cwd
  nocase

  #fs
  #resolveCache
  #resolvePosixCache
  #childrenCache

  /**
   * @param {string} cwdPath - Current working directory
   * @param {Object} pathModule - Path module (posix or win32)
   * @param {string} separator - Path separator
   * @param {Object} options - Options
   */
  constructor(cwdPath = process.cwd(), pathModule, separator, options = {}) {
    const { nocase, childrenCacheSize = 16384, fs } = options

    this.#fs = wrapFileSystem(fs)

    // Handle file:// URLs
    if (cwdPath instanceof URL || cwdPath.startsWith('file://')) {
      cwdPath = fileURLToPath(cwdPath)
    }

    const resolved = pathModule.resolve(cwdPath)
    this.roots = Object.create(null)
    this.rootPath = this.parseRootPath(resolved)

    this.#resolveCache = new PathComponentCache()
    this.#resolvePosixCache = new PathComponentCache()
    this.#childrenCache = new DirectoryEntryCache(childrenCacheSize)

    const parts = resolved.substring(this.rootPath.length).split(separator)
    if (parts.length === 1 && !parts[0]) {
      parts.pop()
    }

    if (nocase === undefined) {
      throw new TypeError('must provide nocase setting to PathScurryBase ctor')
    }

    this.nocase = nocase
    this.root = this.newRoot(this.#fs)
    this.roots[this.rootPath] = this.root

    let current = this.root
    let remaining = parts.length - 1
    const sep = pathModule.sep
    let fullpath = this.rootPath
    let first = false

    for (const part of parts) {
      const depth = remaining--
      current = current.child(part, {
        relative: new Array(depth).fill('..').join(sep),
        relativePosix: new Array(depth).fill('..').join('/'),
        fullpath: fullpath += (first ? '' : sep) + part
      })
      first = true
    }

    this.cwd = current
  }

  /**
   * Get depth of a path
   * @param {string|PathEntry} path - Path to check
   * @returns {number}
   */
  depth(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return path.depth()
  }

  /**
   * Get children cache
   * @returns {DirectoryEntryCache}
   */
  childrenCache() {
    return this.#childrenCache
  }

  /**
   * Resolve paths to absolute path string
   * @param {...string} paths - Paths to resolve
   * @returns {string}
   */
  resolve(...paths) {
    let combined = ''

    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i]
      if (!p || p === '.') continue
      combined = combined ? `${p}/${combined}` : p
      if (this.isAbsolute(p)) break
    }

    let cached = this.#resolveCache.get(combined)
    if (cached !== undefined) return cached

    const resolved = this.cwd.resolve(combined).fullpath()
    this.#resolveCache.set(combined, resolved)
    return resolved
  }

  /**
   * Resolve paths to POSIX-style absolute path
   * @param {...string} paths - Paths to resolve
   * @returns {string}
   */
  resolvePosix(...paths) {
    let combined = ''

    for (let i = paths.length - 1; i >= 0; i--) {
      const p = paths[i]
      if (!p || p === '.') continue
      combined = combined ? `${p}/${combined}` : p
      if (this.isAbsolute(p)) break
    }

    let cached = this.#resolvePosixCache.get(combined)
    if (cached !== undefined) return cached

    const resolved = this.cwd.resolve(combined).fullpathPosix()
    this.#resolvePosixCache.set(combined, resolved)
    return resolved
  }

  /**
   * Get relative path from CWD
   * @param {string|PathEntry} path - Path to relativize
   * @returns {string}
   */
  relative(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return path.relative()
  }

  /**
   * Get POSIX-style relative path
   * @param {string|PathEntry} path - Path to relativize
   * @returns {string}
   */
  relativePosix(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return path.relativePosix()
  }

  /**
   * Get basename of path
   * @param {string|PathEntry} path - Path
   * @returns {string}
   */
  basename(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return path.name
  }

  /**
   * Get dirname of path
   * @param {string|PathEntry} path - Path
   * @returns {string}
   */
  dirname(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return (path.parent || path).fullpath()
  }

  /**
   * Read directory (async)
   * @param {string|PathEntry} path - Directory path
   * @param {Object} options - Options
   * @returns {Promise<Array>}
   */
  async readdir(path = this.cwd, options = { withFileTypes: true }) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    } else if (!(path instanceof PathEntry)) {
      options = path
      path = this.cwd
    }

    const { withFileTypes } = options

    if (!path.canReaddir()) return []

    const entries = await path.readdir()
    return withFileTypes ? entries : entries.map(e => e.name)
  }

  /**
   * Read directory (sync)
   * @param {string|PathEntry} path - Directory path
   * @param {Object} options - Options
   * @returns {Array}
   */
  readdirSync(path = this.cwd, options = { withFileTypes: true }) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    } else if (!(path instanceof PathEntry)) {
      options = path
      path = this.cwd
    }

    const { withFileTypes = true } = options

    if (!path.canReaddir()) return []

    if (withFileTypes) {
      return path.readdirSync()
    }
    return path.readdirSync().map(e => e.name)
  }

  /**
   * Get file stats (async)
   * @param {string|PathEntry} path - Path
   * @returns {Promise<PathEntry|undefined>}
   */
  async lstat(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return path.lstat()
  }

  /**
   * Get file stats (sync)
   * @param {string|PathEntry} path - Path
   * @returns {PathEntry|undefined}
   */
  lstatSync(path = this.cwd) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    }
    return path.lstatSync()
  }

  /**
   * Read symlink target (async)
   * @param {string|PathEntry} path - Path
   * @param {Object} options - Options
   * @returns {Promise<PathEntry|string|undefined>}
   */
  async readlink(path = this.cwd, { withFileTypes } = { withFileTypes: false }) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    } else if (!(path instanceof PathEntry)) {
      withFileTypes = path.withFileTypes
      path = this.cwd
    }

    const result = await path.readlink()
    return withFileTypes ? result : result?.fullpath()
  }

  /**
   * Read symlink target (sync)
   * @param {string|PathEntry} path - Path
   * @param {Object} options - Options
   * @returns {PathEntry|string|undefined}
   */
  readlinkSync(path = this.cwd, { withFileTypes } = { withFileTypes: false }) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    } else if (!(path instanceof PathEntry)) {
      withFileTypes = path.withFileTypes
      path = this.cwd
    }

    const result = path.readlinkSync()
    return withFileTypes ? result : result?.fullpath()
  }

  /**
   * Get real path (async)
   * @param {string|PathEntry} path - Path
   * @param {Object} options - Options
   * @returns {Promise<PathEntry|string|undefined>}
   */
  async realpath(path = this.cwd, { withFileTypes } = { withFileTypes: false }) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    } else if (!(path instanceof PathEntry)) {
      withFileTypes = path.withFileTypes
      path = this.cwd
    }

    const result = await path.realpath()
    return withFileTypes ? result : result?.fullpath()
  }

  /**
   * Get real path (sync)
   * @param {string|PathEntry} path - Path
   * @param {Object} options - Options
   * @returns {PathEntry|string|undefined}
   */
  realpathSync(path = this.cwd, { withFileTypes } = { withFileTypes: false }) {
    if (typeof path === 'string') {
      path = this.cwd.resolve(path)
    } else if (!(path instanceof PathEntry)) {
      withFileTypes = path.withFileTypes
      path = this.cwd
    }

    const result = path.realpathSync()
    return withFileTypes ? result : result?.fullpath()
  }

  /**
   * Change current working directory
   * @param {string|PathEntry} path - New CWD
   */
  chdir(path = this.cwd) {
    const oldCwd = this.cwd
    this.cwd = typeof path === 'string' ? this.cwd.resolve(path) : path
    this.cwd[SET_AS_CWD_SYMBOL](oldCwd)
  }

  // Abstract methods - must be overridden by subclasses
  parseRootPath(resolved) { throw new Error('Must be implemented by subclass') }
  newRoot(fs) { throw new Error('Must be implemented by subclass') }
  isAbsolute(path) { throw new Error('Must be implemented by subclass') }
}

// ============================================================================
// WINDOWS PATH SCURRY
// ============================================================================

/**
 * Windows path scurry implementation
 */
export class WindowsPathScurry extends PathScurry {
  sep = '\\'

  /**
   * @param {string} cwd - Current working directory
   * @param {Object} options - Options
   */
  constructor(cwd = process.cwd(), options = {}) {
    const { nocase = true } = options
    super(cwd, win32Path, '\\', { ...options, nocase })
    this.nocase = nocase

    // Propagate nocase to all ancestors
    for (let entry = this.cwd; entry; entry = entry.parent) {
      entry.nocase = this.nocase
    }
  }

  /**
   * Parse root path from resolved path
   * @param {string} resolved - Resolved path
   * @returns {string}
   */
  parseRootPath(resolved) {
    return win32Path.parse(resolved).root.toUpperCase()
  }

  /**
   * Create new root entry
   * @param {Object} fs - File system implementation
   * @returns {WindowsPathEntry}
   */
  newRoot(fs) {
    return new WindowsPathEntry(
      this.rootPath,
      FILE_TYPE_DIRECTORY,
      undefined,
      this.roots,
      this.nocase,
      this.childrenCache(),
      { fs }
    )
  }

  /**
   * Check if path is absolute
   * @param {string} path - Path to check
   * @returns {boolean}
   */
  isAbsolute(path) {
    return path.startsWith('/') || path.startsWith('\\') || /^[a-z]:(\/|\\)/i.test(path)
  }
}

// ============================================================================
// POSIX PATH SCURRY
// ============================================================================

/**
 * POSIX path scurry implementation
 */
export class PosixPathScurry extends PathScurry {
  sep = '/'

  /**
   * @param {string} cwd - Current working directory
   * @param {Object} options - Options
   */
  constructor(cwd = process.cwd(), options = {}) {
    const { nocase = false } = options
    super(cwd, posixPath, '/', { ...options, nocase })
    this.nocase = nocase
  }

  /**
   * Parse root path (always "/" for POSIX)
   * @param {string} resolved - Resolved path
   * @returns {string}
   */
  parseRootPath(resolved) {
    return '/'
  }

  /**
   * Create new root entry
   * @param {Object} fs - File system implementation
   * @returns {PosixPathEntry}
   */
  newRoot(fs) {
    return new PosixPathEntry(
      this.rootPath,
      FILE_TYPE_DIRECTORY,
      undefined,
      this.roots,
      this.nocase,
      this.childrenCache(),
      { fs }
    )
  }

  /**
   * Check if path is absolute
   * @param {string} path - Path to check
   * @returns {boolean}
   */
  isAbsolute(path) {
    return path.startsWith('/')
  }
}

// ============================================================================
// DARWIN PATH SCURRY
// ============================================================================

/**
 * Darwin (macOS) path scurry - POSIX with case-insensitive default
 */
export class DarwinPathScurry extends PosixPathScurry {
  /**
   * @param {string} cwd - Current working directory
   * @param {Object} options - Options
   */
  constructor(cwd = process.cwd(), options = {}) {
    const { nocase = true } = options
    super(cwd, { ...options, nocase })
  }
}

// ============================================================================
// GLOB PATTERN MATCHER
// ============================================================================

/**
 * Glob pattern segment matcher for path matching
 * Processes glob pattern segments for matching
 * Handles Windows UNC and drive paths
 */
export class GlobPatternMatcher {
  #patterns
  #globs
  #index
  #platform
  #rest
  #globString
  #isUNC
  #isDrive
  #isAbsolute
  #canFollowGlobstar = true
  length

  /**
   * @param {Array} patterns - Pattern segments (strings, regexes, or GLOBSTAR symbol)
   * @param {Array} globs - Original glob strings
   * @param {number} index - Current index
   * @param {string} platform - Platform identifier
   */
  constructor(patterns, globs, index, platform) {
    if (!patterns?.length >= 1) {
      throw new TypeError('empty pattern list')
    }
    if (!globs?.length >= 1) {
      throw new TypeError('empty glob list')
    }
    if (globs.length !== patterns.length) {
      throw new TypeError('mismatched pattern list and glob list lengths')
    }

    this.length = patterns.length

    if (index < 0 || index >= this.length) {
      throw new TypeError('index out of range')
    }

    this.#patterns = patterns
    this.#globs = globs
    this.#index = index
    this.#platform = platform

    // Handle UNC paths and drive letters at index 0
    if (this.#index === 0) {
      if (this.isUNC()) {
        // Combine first 4 segments for UNC path
        const [p0, p1, p2, p3, ...pRest] = this.#patterns
        const [g0, g1, g2, g3, ...gRest] = this.#globs

        if (pRest[0] === '') { pRest.shift(); gRest.shift() }

        const combinedPattern = [p0, p1, p2, p3, ''].join('/')
        const combinedGlob = [g0, g1, g2, g3, ''].join('/')

        this.#patterns = [combinedPattern, ...pRest]
        this.#globs = [combinedGlob, ...gRest]
        this.length = this.#patterns.length
      } else if (this.isDrive() || this.isAbsolute()) {
        // Handle drive letter or absolute path
        const [p0, ...pRest] = this.#patterns
        const [g0, ...gRest] = this.#globs

        if (pRest[0] === '') { pRest.shift(); gRest.shift() }

        const combinedPattern = p0 + '/'
        const combinedGlob = g0 + '/'

        this.#patterns = [combinedPattern, ...pRest]
        this.#globs = [combinedGlob, ...gRest]
        this.length = this.#patterns.length
      }
    }
  }

  /**
   * Get current pattern segment
   * @returns {string|RegExp|Symbol}
   */
  pattern() {
    return this.#patterns[this.#index]
  }

  /**
   * Check if current pattern is a string
   * @returns {boolean}
   */
  isString() {
    return typeof this.#patterns[this.#index] === 'string'
  }

  /**
   * Check if current pattern is globstar (**)
   * @returns {boolean}
   */
  isGlobstar() {
    return this.#patterns[this.#index] === GLOBSTAR_SYMBOL
  }

  /**
   * Check if current pattern is a RegExp
   * @returns {boolean}
   */
  isRegExp() {
    return this.#patterns[this.#index] instanceof RegExp
  }

  /**
   * Get glob string representation
   * @returns {string}
   */
  globString() {
    if (this.#globString) return this.#globString

    if (this.#index === 0) {
      if (this.isAbsolute()) {
        return this.#globString = this.#globs[0] + this.#globs.slice(1).join('/')
      }
      return this.#globString = this.#globs.join('/')
    }

    return this.#globString = this.#globs.slice(this.#index).join('/')
  }

  /**
   * Check if there are more pattern segments
   * @returns {boolean}
   */
  hasMore() {
    return this.length > this.#index + 1
  }

  /**
   * Get next pattern segment matcher
   * @returns {GlobPatternMatcher|null}
   */
  rest() {
    if (this.#rest !== undefined) return this.#rest
    if (!this.hasMore()) return this.#rest = null

    this.#rest = new GlobPatternMatcher(
      this.#patterns,
      this.#globs,
      this.#index + 1,
      this.#platform
    )

    // Copy state flags
    this.#rest.#isAbsolute = this.#isAbsolute
    this.#rest.#isUNC = this.#isUNC
    this.#rest.#isDrive = this.#isDrive

    return this.#rest
  }

  /**
   * Check if this is a UNC path (Windows)
   * @returns {boolean}
   */
  isUNC() {
    if (this.#isUNC !== undefined) return this.#isUNC

    const patterns = this.#patterns
    return this.#isUNC = (
      this.#platform === 'win32' &&
      this.#index === 0 &&
      patterns[0] === '' &&
      patterns[1] === '' &&
      typeof patterns[2] === 'string' && !!patterns[2] &&
      typeof patterns[3] === 'string' && !!patterns[3]
    )
  }

  /**
   * Check if this is a drive letter path (Windows)
   * @returns {boolean}
   */
  isDrive() {
    if (this.#isDrive !== undefined) return this.#isDrive

    const patterns = this.#patterns
    return this.#isDrive = (
      this.#platform === 'win32' &&
      this.#index === 0 &&
      this.length > 1 &&
      typeof patterns[0] === 'string' &&
      /^[a-z]:$/i.test(patterns[0])
    )
  }

  /**
   * Check if path is absolute
   * @returns {boolean}
   */
  isAbsolute() {
    if (this.#isAbsolute !== undefined) return this.#isAbsolute

    const patterns = this.#patterns
    return this.#isAbsolute = (
      patterns[0] === '' && patterns.length > 1 ||
      this.isDrive() ||
      this.isUNC()
    )
  }

  /**
   * Get root component if at index 0
   * @returns {string}
   */
  root() {
    const pattern = this.#patterns[0]
    if (typeof pattern === 'string' && this.isAbsolute() && this.#index === 0) {
      return pattern
    }
    return ''
  }

  /**
   * Check if globstar can follow symlinks
   * @returns {boolean}
   */
  checkFollowGlobstar() {
    return !(this.#index === 0 || !this.isGlobstar() || !this.#canFollowGlobstar)
  }

  /**
   * Mark globstar as following symlinks
   * @returns {boolean}
   */
  markFollowGlobstar() {
    if (this.#index === 0 || !this.isGlobstar() || !this.#canFollowGlobstar) {
      return false
    }
    this.#canFollowGlobstar = false
    return true
  }
}

/** @type {Symbol} Symbol representing globstar (**) in patterns */
export const GLOBSTAR_SYMBOL = Symbol.for('minimatch.GLOBSTAR')

// ============================================================================
// GLOB PATTERN COMPILER
// ============================================================================

/**
 * Glob pattern matcher configuration and compilation
 * Compiles glob patterns with various options and platform handling
 */
export class GlobPatternCompiler {
  relative = []
  relativeChildren = []
  absolute = []
  absoluteChildren = []
  platform
  mmopts

  /**
   * @param {string|Array<string>} patterns - Glob pattern(s)
   * @param {Object} options - Compiler options
   */
  constructor(patterns, options = {}) {
    const {
      nobrace = false,
      nocase = false,
      noext = false,
      noglobstar = false,
      platform = process.platform
    } = options

    this.platform = platform

    // Minimatch options
    this.mmopts = {
      dot: true,
      nobrace,
      nocase,
      noext,
      noglobstar,
      optimizationLevel: 2,
      platform,
      nocomment: true,
      nonegate: true
    }

    const patternList = Array.isArray(patterns) ? patterns : [patterns]
    for (const pattern of patternList) {
      this.add(pattern)
    }
  }

  /**
   * Add a pattern to the compiler
   * @param {string} pattern - Glob pattern
   */
  add(pattern) {
    // Note: This would integrate with minimatch for full implementation
    // For now, we provide the structure

    // In full implementation, this would:
    // 1. Parse pattern with minimatch
    // 2. For each set in parsed result:
    //    - Strip leading dots
    //    - Create GlobPatternMatcher
    //    - Create new minimatch with glob string
    //    - Check if ends with **
    //    - Add to appropriate arrays (relative/absolute, with/without children)
  }

  /**
   * Check if path should be ignored
   * @param {PathEntry} entry - Path entry to check
   * @returns {boolean}
   */
  ignored(entry) {
    const fullPath = entry.fullpath()
    const fullPathSlash = `${fullPath}/`
    const relativePath = entry.relative() || '.'
    const relativePathSlash = `${relativePath}/`

    for (const matcher of this.relative) {
      if (matcher.match(relativePath) || matcher.match(relativePathSlash)) {
        return true
      }
    }

    for (const matcher of this.absolute) {
      if (matcher.match(fullPath) || matcher.match(fullPathSlash)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if children of path should be ignored
   * @param {PathEntry} entry - Path entry to check
   * @returns {boolean}
   */
  childrenIgnored(entry) {
    const fullPathSlash = entry.fullpath() + '/'
    const relativePathSlash = (entry.relative() || '.') + '/'

    for (const matcher of this.relativeChildren) {
      if (matcher.match(relativePathSlash)) {
        return true
      }
    }

    for (const matcher of this.absoluteChildren) {
      if (matcher.match(fullPathSlash)) {
        return true
      }
    }

    return false
  }
}

// ============================================================================
// PLATFORM-SPECIFIC EXPORTS
// ============================================================================

/**
 * Platform-appropriate PathEntry class
 * @type {typeof PosixPathEntry | typeof WindowsPathEntry}
 */
export const PlatformPathEntry = process.platform === 'win32' ? WindowsPathEntry : PosixPathEntry

/**
 * Platform-appropriate PathScurry class
 * @type {typeof WindowsPathScurry | typeof DarwinPathScurry | typeof PosixPathScurry}
 */
export const PlatformPathScurry = process.platform === 'win32'
  ? WindowsPathScurry
  : process.platform === 'darwin'
    ? DarwinPathScurry
    : PosixPathScurry

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Constants
  FILE_TYPE_UNKNOWN,
  FILE_TYPE_FIFO,
  FILE_TYPE_CHARACTER_DEVICE,
  FILE_TYPE_DIRECTORY,
  FILE_TYPE_BLOCK_DEVICE,
  FILE_TYPE_FILE,
  FILE_TYPE_SYMLINK,
  FILE_TYPE_SOCKET,
  FILE_TYPE_MASK,
  FILE_TYPE_CLEAR_MASK,

  // State flags
  STATE_INVALIDATED,
  STATE_STAT_CACHED,
  STATE_READDIR_BLOCKED,
  STATE_LSTAT_CALLED,
  STATE_READLINK_ERROR,
  STATE_READDIR_CALLED,
  STATE_BLOCKED_MASK,
  STATE_FULL_MASK,

  // Symbols and patterns
  SET_AS_CWD_SYMBOL,
  UNC_PATH_PATTERN,
  PATH_SEPARATOR_PATTERN,
  GLOBSTAR_SYMBOL,

  // Utility functions
  normalizeString,
  normalizeCaseInsensitive,
  getFileTypeFromStats,
  normalizeWindowsPath,
  wrapFileSystem,

  // Cache classes
  PathComponentCache,
  DirectoryEntryCache,

  // Path entry classes
  PathEntry,
  PosixPathEntry,
  WindowsPathEntry,

  // Path scurry classes
  PathScurry,
  WindowsPathScurry,
  PosixPathScurry,
  DarwinPathScurry,

  // Glob pattern classes
  GlobPatternMatcher,
  GlobPatternCompiler,

  // Platform-specific exports
  PlatformPathEntry,
  PlatformPathScurry
}
