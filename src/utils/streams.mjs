/**
 * Stream utilities for processing HTTP responses, SSE events, and async iterables
 *
 * This module provides utilities for:
 * - Converting ReadableStreams to async iterators
 * - Processing Server-Sent Events (SSE)
 * - Buffering and chunking stream data
 * - Converting between different stream formats
 *
 * Streaming utilities
 */

/**
 * Converts a ReadableStream to an async iterator
 * Handles proper resource cleanup on errors and completion
 *
 * @param {ReadableStream} stream - The ReadableStream to convert
 * @returns {AsyncIterator} An async iterator that yields chunks from the stream
 *
 */
export function readableStreamToAsyncIterator(stream) {
  if (stream[Symbol.asyncIterator]) {
    return stream
  }

  const reader = stream.getReader()

  return {
    async next() {
      try {
        const result = await reader.read()
        if (result?.done) {
          reader.releaseLock()
        }
        return result
      } catch (error) {
        reader.releaseLock()
        throw error
      }
    },

    async return() {
      const cancelPromise = reader.cancel()
      reader.releaseLock()
      await cancelPromise
      return {
        done: true,
        value: undefined
      }
    },

    [Symbol.asyncIterator]() {
      return this
    }
  }
}

/**
 * Finds the index of the next SSE message boundary in a Uint8Array
 * SSE messages are delimited by double newlines (LF-LF, CR-CR, or CRLF-CRLF)
 *
 * @param {Uint8Array} buffer - Buffer to search for message boundaries
 * @returns {number} Index of the end of the message, or -1 if no boundary found
 *
 */
export function findSSEMessageBoundary(buffer) {
  for (let i = 0; i < buffer.length - 2; i++) {
    // LF-LF (10, 10)
    if (buffer[i] === 10 && buffer[i + 1] === 10) {
      return i + 2
    }

    // CR-CR (13, 13)
    if (buffer[i] === 13 && buffer[i + 1] === 13) {
      return i + 2
    }

    // CRLF-CRLF (13, 10, 13, 10)
    if (
      buffer[i] === 13 &&
      buffer[i + 1] === 10 &&
      i + 3 < buffer.length &&
      buffer[i + 2] === 13 &&
      buffer[i + 3] === 10
    ) {
      return i + 4
    }
  }

  return -1
}

/**
 * Splits an async iterable stream into SSE messages
 * Handles buffering of partial messages across chunks
 *
 * @param {AsyncIterable} stream - Stream of chunks (Uint8Array, ArrayBuffer, or string)
 * @yields {Uint8Array} Complete SSE messages
 *
 */
export async function* splitSSEMessages(stream) {
  let buffer = new Uint8Array()

  for await (const chunk of stream) {
    if (chunk == null) {
      continue
    }

    // Normalize chunk to Uint8Array
    const normalizedChunk =
      chunk instanceof ArrayBuffer
        ? new Uint8Array(chunk)
        : typeof chunk === 'string'
        ? new TextEncoder().encode(chunk)
        : chunk

    // Append to buffer
    const newBuffer = new Uint8Array(buffer.length + normalizedChunk.length)
    newBuffer.set(buffer)
    newBuffer.set(normalizedChunk, buffer.length)
    buffer = newBuffer

    // Yield complete messages
    let boundaryIndex
    while ((boundaryIndex = findSSEMessageBoundary(buffer)) !== -1) {
      yield buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex)
    }
  }

  // Yield remaining buffer if any
  if (buffer.length > 0) {
    yield buffer
  }
}

/**
 * Parses Server-Sent Events (SSE) from a Response stream
 * Yields structured event objects with event type, data, and raw chunks
 *
 * @param {Response} response - Fetch Response object with SSE stream
 * @param {AbortController} abortController - Controller to abort the stream
 * @yields {Object} SSE event objects with {event, data, raw} structure
 *
 */
export async function* parseSSEResponse(response, abortController) {
  if (!response.body) {
    abortController.abort()
    throw new Error('Attempted to iterate over a response with no body')
  }

  const sseDecoder = new SSEDecoder()
  const lineDecoder = new LineDecoder()
  const asyncIterator = readableStreamToAsyncIterator(response.body)

  // Process messages from the split stream
  for await (const chunk of splitSSEMessages(asyncIterator)) {
    for (const line of lineDecoder.decode(chunk)) {
      const event = sseDecoder.decode(line)
      if (event) {
        yield event
      }
    }
  }

  // Flush remaining data
  for (const line of lineDecoder.flush()) {
    const event = sseDecoder.decode(line)
    if (event) {
      yield event
    }
  }
}

/**
 * Server-Sent Events decoder
 * Parses SSE format according to the EventSource spec
 *
 */
export class SSEDecoder {
  constructor() {
    this.event = null
    this.data = []
    this.chunks = []
  }

  /**
   * Decode a single SSE line
   *
   * @param {string} line - Line to decode
   * @returns {Object|null} Event object or null if incomplete
   */
  decode(line) {
    // Trim trailing carriage return
    if (line.endsWith('\r')) {
      line = line.substring(0, line.length - 1)
    }

    // Empty line signals end of event
    if (!line) {
      if (!this.event && !this.data.length) {
        return null
      }

      const event = {
        event: this.event,
        data: this.data.join('\n'),
        raw: this.chunks
      }

      // Reset state
      this.event = null
      this.data = []
      this.chunks = []

      return event
    }

    // Save raw chunk
    this.chunks.push(line)

    // Ignore comments
    if (line.startsWith(':')) {
      return null
    }

    // Parse field
    const [field, separator, value] = splitOnce(line, ':')
    let normalizedValue = value

    // Strip leading space from value
    if (normalizedValue.startsWith(' ')) {
      normalizedValue = normalizedValue.substring(1)
    }

    // Process field
    if (field === 'event') {
      this.event = normalizedValue
    } else if (field === 'data') {
      this.data.push(normalizedValue)
    }

    return null
  }
}

/**
 * Split a string on the first occurrence of a delimiter
 *
 * @param {string} str - String to split
 * @param {string} delimiter - Delimiter to split on
 * @returns {[string, string, string]} [before, delimiter, after]
 *
 */
export function splitOnce(str, delimiter) {
  const index = str.indexOf(delimiter)
  if (index !== -1) {
    return [
      str.substring(0, index),
      delimiter,
      str.substring(index + delimiter.length)
    ]
  }
  return [str, '', '']
}

/**
 * Line decoder that buffers partial lines and decodes text
 * Handles newlines (LF, CR, CRLF) correctly across chunk boundaries
 *
 */
export class LineDecoder {
  constructor() {
    this.buffer = new Uint8Array()
    this.carriageReturnIndex = null
    this.textDecoder = null
  }

  /**
   * Decode chunks into lines
   *
   * @param {Uint8Array|ArrayBuffer|string|null} chunk - Chunk to decode
   * @returns {string[]} Array of complete lines
   */
  decode(chunk) {
    if (chunk == null) {
      return []
    }

    // Normalize to Uint8Array
    const normalizedChunk =
      chunk instanceof ArrayBuffer
        ? new Uint8Array(chunk)
        : typeof chunk === 'string'
        ? new TextEncoder().encode(chunk)
        : chunk

    // Append to buffer
    const newBuffer = new Uint8Array(this.buffer.length + normalizedChunk.length)
    newBuffer.set(this.buffer)
    newBuffer.set(normalizedChunk, this.buffer.length)
    this.buffer = newBuffer

    const lines = []
    let lineInfo

    while ((lineInfo = findNewlineInBuffer(this.buffer, this.carriageReturnIndex)) != null) {
      // Handle standalone CR
      if (lineInfo.carriage && this.carriageReturnIndex == null) {
        this.carriageReturnIndex = lineInfo.index
        continue
      }

      // Handle CR followed by something other than LF
      if (
        this.carriageReturnIndex != null &&
        (lineInfo.index !== this.carriageReturnIndex + 1 || lineInfo.carriage)
      ) {
        lines.push(this.decodeText(this.buffer.slice(0, this.carriageReturnIndex - 1)))
        this.buffer = this.buffer.slice(this.carriageReturnIndex)
        this.carriageReturnIndex = null
        continue
      }

      // Normal case: extract line
      const preceding =
        this.carriageReturnIndex !== null ? lineInfo.preceding - 1 : lineInfo.preceding
      const line = this.decodeText(this.buffer.slice(0, preceding))
      lines.push(line)
      this.buffer = this.buffer.slice(lineInfo.index)
      this.carriageReturnIndex = null
    }

    return lines
  }

  /**
   * Decode bytes to text using Buffer (Node.js) or TextDecoder (browser)
   *
   * @param {Uint8Array|Buffer|string} bytes - Bytes to decode
   * @returns {string} Decoded text
   */
  decodeText(bytes) {
    if (bytes == null) {
      return ''
    }

    if (typeof bytes === 'string') {
      return bytes
    }

    // Node.js environment
    if (typeof Buffer !== 'undefined') {
      if (bytes instanceof Buffer) {
        return bytes.toString()
      }
      if (bytes instanceof Uint8Array) {
        return Buffer.from(bytes).toString()
      }
      throw new Error(
        `Unexpected: received non-Uint8Array (${bytes.constructor.name}) stream chunk in an environment with a global "Buffer" defined, which this library assumes to be Node. Please report this error.`
      )
    }

    // Browser environment
    if (typeof TextDecoder !== 'undefined') {
      if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) {
        // Lazily create TextDecoder
        this.textDecoder = this.textDecoder ?? new TextDecoder('utf8')
        return this.textDecoder.decode(bytes)
      }
      throw new Error(
        `Unexpected: received non-Uint8Array/ArrayBuffer (${bytes.constructor.name}) in a web platform. Please report this error.`
      )
    }

    throw new Error(
      'Unexpected: neither Buffer nor TextDecoder are available as globals. Please report this error.'
    )
  }

  /**
   * Flush remaining buffer as a final line
   *
   * @returns {string[]} Array with final line if buffer has content
   */
  flush() {
    if (!this.buffer.length) {
      return []
    }
    return this.decode('\n')
  }
}

// Static properties
LineDecoder.NEWLINE_CHARS = new Set(['\n', '\r'])
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g

/**
 * Find newline character in buffer
 *
 * @param {Uint8Array} buffer - Buffer to search
 * @param {number|null} startIndex - Optional start index
 * @returns {Object|null} Line info {preceding, index, carriage} or null
 *
 */
export function findNewlineInBuffer(buffer, startIndex = null) {
  for (let i = startIndex ?? 0; i < buffer.length; i++) {
    // LF (10)
    if (buffer[i] === 10) {
      return {
        preceding: i,
        index: i + 1,
        carriage: false
      }
    }

    // CR (13)
    if (buffer[i] === 13) {
      return {
        preceding: i,
        index: i + 1,
        carriage: true
      }
    }
  }

  return null
}

/**
 * Wrapper for streaming JSON responses
 * Provides async iteration, tee (split), and conversion to ReadableStream
 *
 */
export class StreamingJSONResponse {
  constructor(iterator, controller) {
    this.iterator = iterator
    this.controller = controller
  }

  /**
   * Create from SSE Response
   *
   * @param {Response} response - Fetch Response object
   * @param {AbortController} controller - Abort controller
   * @returns {StreamingJSONResponse} Streaming response wrapper
   */
  static fromSSEResponse(response, controller) {
    let consumed = false

    async function* generator() {
      if (consumed) {
        throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.')
      }
      consumed = true
      let finished = false

      try {
        for await (const event of parseSSEResponse(response, controller)) {
          // Handle completion events
          if (event.event === 'completion') {
            try {
              yield JSON.parse(event.data)
            } catch (error) {
              console.error('Could not parse message into JSON:', event.data)
              console.error('From chunk:', event.raw)
              throw error
            }
          }

          // Handle message streaming events
          if (
            event.event === 'message_start' ||
            event.event === 'message_delta' ||
            event.event === 'message_stop' ||
            event.event === 'content_block_start' ||
            event.event === 'content_block_delta' ||
            event.event === 'content_block_stop'
          ) {
            try {
              yield JSON.parse(event.data)
            } catch (error) {
              console.error('Could not parse message into JSON:', event.data)
              console.error('From chunk:', event.raw)
              throw error
            }
          }

          // Ignore ping events
          if (event.event === 'ping') {
            continue
          }

          // Handle errors
          if (event.event === 'error') {
            // API error class
            throw new Error(`SSE Error: ${event.data}`)
          }
        }

        finished = true
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        throw error
      } finally {
        if (!finished) {
          controller.abort()
        }
      }
    }

    return new StreamingJSONResponse(generator, controller)
  }

  /**
   * Create from generic ReadableStream
   *
   * @param {ReadableStream} stream - ReadableStream to wrap
   * @param {AbortController} controller - Abort controller
   * @returns {StreamingJSONResponse} Streaming response wrapper
   */
  static fromReadableStream(stream, controller) {
    let consumed = false

    // Inner generator that yields lines
    async function* lineGenerator() {
      const lineDecoder = new LineDecoder()
      const asyncIterator = readableStreamToAsyncIterator(stream)

      for await (const chunk of asyncIterator) {
        for (const line of lineDecoder.decode(chunk)) {
          yield line
        }
      }

      for (const line of lineDecoder.flush()) {
        yield line
      }
    }

    // Outer generator that parses JSON
    async function* jsonGenerator() {
      if (consumed) {
        throw new Error('Cannot iterate over a consumed stream, use `.tee()` to split the stream.')
      }
      consumed = true
      let finished = false

      try {
        for await (const line of lineGenerator()) {
          if (finished) {
            continue
          }
          if (line) {
            yield JSON.parse(line)
          }
        }
        finished = true
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        throw error
      } finally {
        if (!finished) {
          controller.abort()
        }
      }
    }

    return new StreamingJSONResponse(jsonGenerator, controller)
  }

  [Symbol.asyncIterator]() {
    return this.iterator()
  }

  /**
   * Split the stream into two independent streams
   * Allows multiple consumers of the same stream
   *
   * @returns {[StreamingJSONResponse, StreamingJSONResponse]} Two independent streams
   */
  tee() {
    const queue1 = []
    const queue2 = []
    const iterator = this.iterator()

    const makeIterator = (queue) => {
      return {
        next: () => {
          if (queue.length === 0) {
            const promise = iterator.next()
            queue1.push(promise)
            queue2.push(promise)
          }
          return queue.shift()
        }
      }
    }

    return [
      new StreamingJSONResponse(() => makeIterator(queue1), this.controller),
      new StreamingJSONResponse(() => makeIterator(queue2), this.controller)
    ]
  }

  /**
   * Convert to a standard ReadableStream
   * Encodes JSON objects as newline-delimited JSON
   *
   * @returns {ReadableStream} ReadableStream of JSON strings
   */
  toReadableStream() {
    const self = this
    let iterator
    const encoder = new TextEncoder()

    return new ReadableStream({
      async start() {
        iterator = self[Symbol.asyncIterator]()
      },

      async pull(controller) {
        try {
          const { value, done } = await iterator.next()

          if (done) {
            return controller.close()
          }

          const encoded = encoder.encode(JSON.stringify(value) + '\n')
          controller.enqueue(encoded)
        } catch (error) {
          controller.error(error)
        }
      },

      async cancel() {
        await iterator.return?.()
      }
    })
  }
}

export { readableStreamToAsyncIterator as Og }
export { splitOnce as yb4 }
